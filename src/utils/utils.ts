export const makeLog =
    (ns: NS) =>
    (str: string, ...args: any[]) => {
        if (ns.getHostname() == "home") {
            ns.tprint(`[${ns.getHostname()}] ${ns.sprintf(str, args)}`);
        }
        ns.print(`[${ns.getHostname()}] ${ns.sprintf(str, args)}`);
    };
