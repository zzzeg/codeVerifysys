export const TABLE_PREFIX = "verify_";

export const table = (name: string) => `\`${TABLE_PREFIX}${name}\``;
