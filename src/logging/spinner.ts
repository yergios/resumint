const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const TICK_MS = 80;

export interface Spinner {
    stop(): void;
}

// Logs stay buffered until print() runs at the very end, so a long
// generation would otherwise show nothing until it's done. This ticks a
// single status line in the meantime. No-ops off a TTY: piped/redirected
// output shouldn't get carriage-return control characters mixed into it.
export function startSpinner(label: string): Spinner {
    if (!process.stdout.isTTY) {
        return { stop() {} };
    }

    let frame = 0;
    let lastLength = 0;
    const startT = performance.now();

    const render = (): void => {
        const elapsed = ((performance.now() - startT) / 1000).toFixed(1);
        const line = `${FRAMES[frame++ % FRAMES.length]} ${label} (${elapsed}s)`;
        process.stdout.write(`\r${line}`);
        lastLength = line.length;
    };

    render();
    const interval = setInterval(render, TICK_MS);

    return {
        stop(): void {
            clearInterval(interval);
            process.stdout.write(`\r${" ".repeat(lastLength)}\r`);
        }
    };
}
