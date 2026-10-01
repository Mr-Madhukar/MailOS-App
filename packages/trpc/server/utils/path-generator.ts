export function generatePath(base: string) {
  return function (path: string): `/${string}` {
    const cleanBase = base.replace(/^\/+/, "").replace(/\/+$/, "");
    const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
    return `/${[cleanBase, cleanPath].filter(Boolean).join("/")}`;
  };
}
