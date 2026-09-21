const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "q", ң: "ng", ө: "o", ұ: "u", ү: "u",
  һ: "h", і: "i",
};

export function translit(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((ch) => (MAP[ch] !== undefined ? MAP[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ученик входит по фамилии и имени — из них строится технический логин. */
export function studentEmail(lastName: string, firstName: string): string {
  const slug = `${translit(lastName)}.${translit(firstName)}`;
  return `${slug}@cor-5class.local`;
}

export function fullName(lastName: string, firstName: string): string {
  return `${lastName.trim()} ${firstName.trim()}`.trim();
}
