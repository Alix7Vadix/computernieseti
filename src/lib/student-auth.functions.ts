import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

async function publicAuthClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function signInWithLogin(email: string, password: string) {
  const client = await publicAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

/** Список классов для выбора при регистрации и входе ученика. */
export const listClasses = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: classes } = await supabaseAdmin
    .from("classes")
    .select("id, name, teacher_id")
    .order("name");
  const teacherIds = [...new Set((classes ?? []).map((c) => c.teacher_id))];
  const { data: teachers } = teacherIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", teacherIds)
    : { data: [] as { id: string; full_name: string }[] };
  const names = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));
  return (classes ?? []).map((c) => ({
    id: c.id,
    label: names.get(c.teacher_id) ? `${c.name} — ${names.get(c.teacher_id)}` : c.name,
  }));
});

const registerSchema = z.object({
  lastName: z.string().trim().min(1).max(60),
  firstName: z.string().trim().min(1).max(60),
  classId: z.string().uuid(),
  password: z.string().min(6).max(72),
});

export const registerStudent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registerSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lastName = clean(data.lastName);
    const firstName = clean(data.firstName);

    const { data: cls } = await supabaseAdmin
      .from("classes")
      .select("id, name")
      .eq("id", data.classId)
      .maybeSingle();
    if (!cls) return { ok: false as const, error: "Класс не найден" };

    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("class_id", cls.id)
      .ilike("last_name", lastName)
      .ilike("first_name", firstName);

    // Уникальный код активации — нужен для входа, если в классе есть однофамильцы.
    let code = makeCode();
    for (let i = 0; i < 5; i++) {
      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("activation_code", code)
        .maybeSingle();
      if (!taken) break;
      code = makeCode();
    }

    // Технический логин ученика — случайный и скрытый, ученик его не видит.
    const loginEmail = `s-${crypto.randomUUID()}@students.cor5.local`;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: `${lastName} ${firstName}`, role: "student" },
    });
    if (createError || !created.user) {
      console.error("registerStudent createUser", createError);
      return { ok: false as const, error: "Не удалось создать аккаунт. Попробуйте ещё раз." };
    }
    const userId = created.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: `${lastName} ${firstName}`,
        last_name: lastName,
        first_name: firstName,
        class_id: cls.id,
        activation_code: code,
      });
    if (profileError) {
      console.error("registerStudent profile", profileError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { ok: false as const, error: "Не удалось сохранить данные ученика." };
    }

    await supabaseAdmin.from("class_members").insert({ class_id: cls.id, student_id: userId });

    const session = await signInWithLogin(loginEmail, data.password);
    if (!session) return { ok: false as const, error: "Аккаунт создан, но войти не удалось. Попробуйте войти." };

    return {
      ok: true as const,
      session,
      activationCode: code,
      hasNamesakes: (count ?? 0) > 0,
    };
  });

const loginSchema = z.object({
  lastName: z.string().trim().min(1).max(60),
  firstName: z.string().trim().min(1).max(60),
  classId: z.string().uuid(),
  password: z.string().min(1).max(72),
  code: z.string().trim().max(12).optional(),
});

export const loginStudent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matches } = await supabaseAdmin
      .from("profiles")
      .select("id, activation_code")
      .eq("class_id", data.classId)
      .ilike("last_name", clean(data.lastName))
      .ilike("first_name", clean(data.firstName));

    const fail = { ok: false as const, needCode: false, error: "Неверные данные или пароль" };
    if (!matches || matches.length === 0) return fail;

    let candidates = matches;
    const code = data.code?.toUpperCase();
    if (code) {
      candidates = matches.filter((m) => m.activation_code === code);
      if (candidates.length === 0) return { ...fail, error: "Неверный код активации" };
    }

    // Пробуем пароль для каждого совпадения; если подходит несколько — нужен код.
    const ok: { id: string; session: { access_token: string; refresh_token: string } }[] = [];
    for (const m of candidates) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.id);
      const email = u.user?.email;
      if (!email) continue;
      const session = await signInWithLogin(email, data.password);
      if (session) ok.push({ id: m.id, session });
    }

    if (ok.length === 0) return fail;
    if (ok.length > 1) {
      return {
        ok: false as const,
        needCode: true,
        error: "В классе есть ученики с такими же фамилией и именем. Введите свой код активации.",
      };
    }
    return { ok: true as const, session: ok[0]!.session };
  });
