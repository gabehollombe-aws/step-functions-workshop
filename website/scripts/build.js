const { execSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')
const uuid = require('uuid/v4')

const getUnifiedDiff = (sha) => {
    const output = execSync(`git diff -p ${sha}^ ${sha}`, {
        cwd: `${__dirname}/../..`
    })
    return output.toString()
}

const showFileAtSha = (sha, path) => {
    const output = execSync(`git show ${sha}:${path}`, {
        cwd: `${__dirname}/../..`
    })
    return output.toString()
}

const templatize = (str, match) => {
    const CLIPBOARD_BUTTON_TAG_TEMPLATE = '<button class="clipboard" data-clipboard-target="#__TARGET_ID__">this text</button> (click the gray button to copy to clipboard).' // trailing space important
    const CLIPBOARD_PRE_TAG_TEMPLATE = '{{% safehtml %}}<pre id="__TARGET_ID__" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">__FILE_CONTENT__</pre>{{% /safehtml %}}'

    const fileContent = showFileAtSha(match.groups.sha, match.groups.file)
    const id = "id" + uuid().replace(/-/g,"")

    const buttonHtml = CLIPBOARD_BUTTON_TAG_TEMPLATE.replace('__TARGET_ID__', id)
    const preHtml = CLIPBOARD_PRE_TAG_TEMPLATE.replace('__TARGET_ID__', id).replace('__FILE_CONTENT__', fileContent + "\n")

    const startOfMatch = match.index
    const endOfMatch = startOfMatch + match[0].length
    const compiledTemplate = str.slice(0, startOfMatch) + buttonHtml + match.groups.rest + preHtml + "\n" + str.substr(endOfMatch + 1)
    return compiledTemplate
}

const nextMatch = (str) => {
    const buttonRegex = /___CLIPBOARD_BUTTON (?<sha>.+):(?<file>.+)\|(?<rest>.*)/gm
    const buttonMatches = Array.from(str.matchAll(buttonRegex))
    return buttonMatches[0]
}

const main = () => {
    // templatePath="../source_content/test_index.md"
    templatePath="../source_content/source_index.md"
    compiledPath="../content/_index.md"

    let templateBufferStr = readFileSync(templatePath).toString()
    let match = nextMatch(templateBufferStr)
    while (match) {
        console.log('Match', match)
        templateBufferStr = templatize(templateBufferStr, match)
        match = nextMatch(templateBufferStr)
    }

    writeFileSync(compiledPath, templateBufferStr)    

    console.log('Done inserting clipboard buttons.')
}

main()