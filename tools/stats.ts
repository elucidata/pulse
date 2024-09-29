import { $, ShellPromise } from "bun"

async function reportSizes(object: Record<string, ShellPromise>) {
    const labels = Object.keys(object)
    const sizes = await Promise.all(Object.values(object))
    console.log(
        "Sizes\n -",
        sizes
            .map((s, i) => `${labels[i].trim()}: ${String(s.stdout).trim()}`)
            .join("\n - ")
    )
}

reportSizes({
    Core: $`gzip -c9 dist/index.js dist/internals.js | wc -c | numfmt --to=si`.quiet(),
    Utils: $`gzip -c9 dist/utils/*.js | wc -c | numfmt --to=si`.quiet(),
    React: $`gzip -c9 dist/react/*.js | wc -c | numfmt --to=si`.quiet(),
    View: $`gzip -c9 dist/view/*.js | wc -c | numfmt --to=si`.quiet(),
})
