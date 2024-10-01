import { $ } from "bun"

async function buildPromptTemplate() {
  const internals = (await $`cat dist/internals.d.ts`.quiet()).stdout.toString()
  const view = (await $`cat dist/view/index.d.ts`.quiet()).stdout.toString()

  let prompt =
    "The following <interface/> blocks define the core of the '@elucidata/pulse' node package.\n\n[YOUR PROMPT HERE]\n\n"

  prompt += `<interface type="typescript" for="@elucdata/pulse">\n${internals.trim()}\n</interface>\n\n`
  prompt += `<interface type="typescript" for="@elucdata/pulse/view">\n${view.trim()}\n</interface>\n`

  // Make sure the 'temp' directory exists
  await $`mkdir -p temp`
  // Write to file: 'temp/prompt.md'
  await $`echo ${prompt} > temp/prompt.md`.quiet()

  console.log("Prompt template built: 'temp/prompt.md'\n")
}

buildPromptTemplate()
