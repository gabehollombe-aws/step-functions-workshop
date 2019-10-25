// const Git = require("nodegit");

const { execSync } = require('child_process')

// const diffWithParent = async (commit) => {
//     const diffs = await commit.getDiff()
//     diffs.forEach( async (d) => {
//         const patches = await d.patches()
//         patches.forEach( async (p) => {
//             const hunks = await p.hunks()
//             hunks.forEach( async (h) => {
//                 const lines = await h.lines()
//                 console.log(
//                     "diff", 
//                     p.oldFile().path(), 
//                     p.newFile().path()
//                 );
//                 console.log(h.header().trim());
//                 lines.forEach(function(line) {
//                     console.log(String.fromCharCode(line.origin()) + line.content().trim());
//                 });
//             })
//         })
//     })

// }


// const main = async() => {
//     const repo = await Git.Repository.open("../..")

//     const commit = await repo.getCommit("03eee8d58ad56817b84197e45c12f2ce83ae8d52")
//     const entry = await commit.getEntry("serverless.yml")
//     const blob = await entry.getBlob()

//     console.log("file contents", blob.toString())

//     await diffWithParent(commit)
// }

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

const main = () => {
    sha = "03eee8d58ad56817b84197e45c12f2ce83ae8d52"
    console.log(showFileAtSha(sha, "serverless.yml"))
    
    console.log(getUnifiedDiff(sha))

}

main()