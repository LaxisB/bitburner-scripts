export const PORT = 1;

const HISTORY_SIZE = 200;

interface Item {
    action: "hack";
    res: number;
    time: number;
    dur: number;
}

export async function main(ns: NS) {
    ns.disableLog("ALL");
    const queue = ns.getPortHandle(PORT);
    ns.tail();

    let items: Item[] = [];

    while (true) {
        while (!queue.empty()) {
            items.push(JSON.parse(queue.read() as string));
        }
        items = items.slice(-HISTORY_SIZE).sort((a, b) => a.time - b.time);

        const lastItem = items[items.length - 1];
        if (!lastItem) {
            await ns.sleep(5000);
            continue;
        }

        ns.printf(
            "%s items logged; next item: %s (%s$)",
            items.length,
            ns.tFormat(lastItem.time),
            lastItem.res
        );

        await ns.sleep(1000);
    }
}
