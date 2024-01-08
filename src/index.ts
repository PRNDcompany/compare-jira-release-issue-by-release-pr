import * as core from "@actions/core";
import * as github from "@actions/github";
import * as request from "request-promise";
import {Octokit} from "@octokit/rest";


(async () => {
    const githubToken = core.getInput("github-token")
    const jiraToken = core.getInput("jira-token")
    const jiraDomain = core.getInput("jira-domain")
    const jiraProject = core.getInput("jira-project")
    const jiraVersionPrefix = core.getInput("jira-version-prefix")

    const payload = github.context.payload

    const repository = payload.repository
    if (repository == null) {
        core.setFailed("github.context.payload.repository is null")
        return
    }
    const owner = repository.owner.login
    const repo = repository.name
    const prNumber = payload.number
    const pullRequest = payload.pull_request
    if (pullRequest == null) {
        core.setFailed("github.context.payload.pull_request is null")
        return
    }
    const branchName = pullRequest.head.ref

    try {
        const jiraVersionName = getJiraVersionName(branchName, jiraVersionPrefix)
        console.log("jiraVersionName: ", jiraVersionName)
        if (jiraVersionName == null) {
            core.setFailed("jiraVersionName is null")
            return
        }

        const commitMessages = await getGitHubCommitMessages(githubToken, owner, repo, prNumber)
        const rawJiraIssueKeys = extractJiraIssueKeys(commitMessages)
        console.log("raw jiraIssueKeys: ", rawJiraIssueKeys)
        const jiraBaseUrl = `https://${jiraDomain}.atlassian.net/rest/api/3`
        const targetVersionJiraKeys: string[] = await getTargetVersionJiraKeys(jiraToken, jiraBaseUrl, jiraProject, jiraVersionName)
        console.log("targetVersionJiraKeys: ", targetVersionJiraKeys)

        const missingIssueKeys: string[] = targetVersionJiraKeys.filter((key: string) => !rawJiraIssueKeys.includes(key))
        console.log("missingIssueKeys: ", missingIssueKeys)
        core.setOutput("missing_issue_keys", missingIssueKeys)
    } catch (error: any) {
        core.setFailed(error.message);
    }

})();


async function getGitHubCommitMessages(githubToken: string, owner: string, repo: string, prNumber: number): Promise<string[]> {

    const octokit = new Octokit({auth: githubToken,})
    const result: any[] = await octokit.paginate("GET /repos/{owner}/{repo}/pulls/{prNum}/commits", {
        "owner": owner,
        "repo": repo,
        "prNum": prNumber,
        "per_page": 100,
        "headers": {
            "X-GitHub-Api-Version": "2022-11-28",
        },
    })

    return result.flat().map((data: any) => {
        return data.commit.message
    })
}

function extractJiraIssueKeys(commitMessages: string[]): string[] {
    const jiraKeys: string[] = []
    for (const commitMessage of commitMessages) {
        const regex = new RegExp(`[A-Z]+-\\d+`, "g")
        // Find jira id per commitMessage
        const matches: string[] | null = regex.exec(commitMessage)
        if (matches == null) {
            continue
        }
        for (const match of matches) {
            if (jiraKeys.find((element: string) => element === match)) {
                // Already exist
            } else {
                jiraKeys.push(match)
            }
        }
    }
    // sort by number
    return jiraKeys.sort((first, second) => (first > second ? 1 : -1))
}

function getJiraVersionName(branchName: string, jiraVersionPrefix?: string): string | null {
    const regex = new RegExp(`/(\\d+\\.\\d+\\.\\d+)`, "g")
    const matches: string[] | null = regex.exec(branchName)
    if (matches == null) {
        return null
    }
    const versionName = matches[1]
    if (jiraVersionPrefix != null) {
        return `${jiraVersionPrefix} ${versionName}`
    } else {
        return versionName
    }
}

async function getTargetVersionJiraKeys(jiraToken: string, jiraBaseUrl: string, jiraProject: string, jiraVersionName: string) {
    //https://yourdomain.atlassian.net/rest/api/3/search
    const url = `${jiraBaseUrl}/search`
    const result = await request.post(url, {
        headers: {
            Authorization: `Basic ${jiraToken}`
        },
        json: true,
        body: {
            "maxResults": 1000,
            "fields": ["key"],
            "jql": `project = "${jiraProject}" and fixversion = "${jiraVersionName}"`
        }
    });

    return result.issues.map((issue: any) => issue.key)
}
