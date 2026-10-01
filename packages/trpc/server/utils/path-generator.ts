function trimSlashes(str: string): string {
  let s = str;
  while (s.startsWith("/")) {
    s = s.slice(1);
  }
  while (s.endsWith("/")) {
    s = s.slice(0, -1);
  }
  return s;
}

export function generatePath(base: string) {
  return function (path: string): `/${string}` {
    const cleanBase = trimSlashes(base);
    const cleanPath = trimSlashes(path);
    return `/${[cleanBase, cleanPath].filter(Boolean).join("/")}`;
  };
}
