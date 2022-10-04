import { LOG_MAX_SIZE } from "utils/constants";

export interface ColumnBase {
    header: string;
    width?: number;
    alignLeft?: boolean;
    format?: string;
}
export interface KeyedCol<T> extends ColumnBase {
    key: keyof T;
}
export interface GetterCol<T> extends ColumnBase {
    getter: (item: T) => string;
}

export type TableColumn<T> = KeyedCol<T> | GetterCol<T>;
export interface TableConfig<T> {
    padding: number;
    columns: TableColumn<T>[];
}
export function table<T>(ns: NS, items: T[], config: TableConfig<T>) {
    const PADDING = 2;

    const columnFormats = config.columns.map((col) =>
        col.format
            ? col.format
            : `${" ".repeat(PADDING)}%${col.alignLeft ? "-" : ""}${
                  col.width ?? 1 ?? 1
              }s ${" ".repeat(PADDING)}`
    );

    // empty log
    Array.from({ length: LOG_MAX_SIZE }).forEach(() => ns.print(""));

    const headerRow = config.columns
        .map((c, i) => ns.sprintf(columnFormats[i], c.header))
        .join("|");
    ns.print(headerRow);
    ns.print(headerRow.replaceAll(/./g, "-"));

    items.forEach((item) => {
        const itemRow = config.columns
            .map((c, i) =>
                ns.sprintf(
                    columnFormats[i],
                    "getter" in c ? c.getter(item) : item[c.key]
                )
            )
            .join("|");
        ns.print(itemRow);
    });
}
