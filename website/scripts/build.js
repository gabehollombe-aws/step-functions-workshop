const { execSync } = require('child_process')
const { readFileSync } = require('fs')
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

const getTemplateContents = (path) => {

}

const main = () => {
    sha = "03eee8d58ad56817b84197e45c12f2ce83ae8d52"

    templatePath="../source_content/test_index.md"
    compiledPath="/tmp/result.md"

    CLIPBOARD_BUTTON_TAG_TEMPLATE = '<button class="clipboard" data-clipboard-target="__TARGET_ID__">this text</button>'
    CLIPBOARD_PRE_TAG_TEMPLATE = '<pre id="__TARGET_ID__" style="position: absolute; left: -1000px; top: -1000px; width: 1px; height: 1px;">__FILE_CONTENT__</pre>'

    console.log(showFileAtSha(sha, "serverless.yml"))
    
    console.log(getUnifiedDiff(sha))

    const template = readFileSync(templatePath).toString()

    const buttonRegex = /___CLIPBOARD_BUTTON (?<sha>.+):(?<file>\w+\.\w+) .+$/gm
    const buttonMatches = Array.from(template.matchAll(buttonRegex))

    const match = buttonMatches[0]
    const fileContent = showFileAtSha(match.groups.sha, match.groups.file)
    const id = uuid()
    const buttonHtml = CLIPBOARD_BUTTON_TAG_TEMPLATE.replace('__TARGET_ID__', id)
    const preHtml = CLIPBOARD_PRE_TAG_TEMPLATE.replace('__TARGET_ID__', id).replace('__FILE_CONTENT__', fileContent)

    console.log(buttonHtml)
    console.log(preHtml)



}


main()