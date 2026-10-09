// Разделы кабинета — отдельно от компонента: их читает и серверная страница (?tab=…), и меню под аватаркой.
export const ACC_TABS = ["overview", "codes", "purchases", "packs", "sales", "settings"] as const;
export type AccTab = (typeof ACC_TABS)[number];
