"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const request = __importStar(require("request-promise"));
const rest_1 = require("@octokit/rest");
(async () => {
    const githubToken = core.getInput("github-token");
    const jiraToken = core.getInput("jira-token");
    const jiraDomain = core.getInput("jira-domain");
    const jiraProject = core.getInput("jira-project");
    const jiraVersionPrefix = core.getInput("jira-version-prefix");
    const payload = github.context.payload;
    const repository = payload.repository;
    if (repository == null) {
        core.setFailed("github.context.payload.repository is null");
        return;
    }
    const owner = repository.owner.login;
    const repo = repository.name;
    const prNumber = payload.number;
    const pullRequest = payload.pull_request;
    if (pullRequest == null) {
        core.setFailed("github.context.payload.pull_request is null");
        return;
    }
    const branchName = pullRequest.head.ref;
    try {
        const jiraVersionName = getJiraVersionName(branchName, jiraVersionPrefix);
        console.log("jiraVersionName: ", jiraVersionName);
        if (jiraVersionName == null) {
            core.setFailed("jiraVersionName is null");
            return;
        }
        const commitMessages = await getGitHubCommitMessages(githubToken, owner, repo, prNumber);
        console.log("commitMessages: ", commitMessages);
        const rawJiraIssueKeys = extractJiraIssueKeys(commitMessages);
        console.log("raw jiraIssueKeys: ", rawJiraIssueKeys);
        const jiraBaseUrl = `https://${jiraDomain}.atlassian.net/rest/api/3`;
        const targetVersionJiraKeys = await getTargetVersionJiraKeys(jiraToken, jiraBaseUrl, jiraProject, jiraVersionName);
        console.log("targetVersionJiraKeys: ", targetVersionJiraKeys);
        const missingIssueKeys = targetVersionJiraKeys.filter((key) => !rawJiraIssueKeys.includes(key));
        console.log("missingIssueKeys: ", missingIssueKeys);
        core.setOutput("missing_issue_keys", missingIssueKeys);
    }
    catch (error) {
        core.setFailed(error.message);
    }
})();
async function getGitHubCommitMessages(githubToken, owner, repo, prNumber) {
    const octokit = new rest_1.Octokit({ auth: githubToken, });
    const result = await octokit.paginate("GET /repos/{owner}/{repo}/pulls/{prNum}/commits", {
        "owner": owner,
        "repo": repo,
        "prNum": prNumber,
        "per_page": 100,
        "headers": {
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
    return result.flat().map((data) => {
        return data.commit.message;
    });
}
function extractJiraIssueKeys(commitMessages) {
    const jiraKeys = [];
    const noJiraKeyCommieMessages = [];
    for (const commitMessage of commitMessages) {
        const regex = new RegExp(`[A-Z]+-\\d+`, "g");
        // Find jira id per commitMessage
        const matches = regex.exec(commitMessage);
        if (matches == null) {
            noJiraKeyCommieMessages.push(commitMessage);
            continue;
        }
        for (const match of matches) {
            if (jiraKeys.find((element) => element === match)) {
                // Already exist
            }
            else {
                jiraKeys.push(match);
            }
        }
    }
    if (noJiraKeyCommieMessages.length > 0) {
        console.log("No jira id found in commit message: ", noJiraKeyCommieMessages);
    }
    // sort by number
    return jiraKeys.sort((first, second) => (first > second ? 1 : -1));
}
function getJiraVersionName(branchName, jiraVersionPrefix) {
    const regex = new RegExp(`/(\\d+\\.\\d+\\.\\d+)`, "g");
    const matches = regex.exec(branchName);
    if (matches == null) {
        return null;
    }
    const versionName = matches[1];
    if (jiraVersionPrefix != null) {
        return `${jiraVersionPrefix} ${versionName}`;
    }
    else {
        return versionName;
    }
}
async function getTargetVersionJiraKeys(jiraToken, jiraBaseUrl, jiraProject, jiraVersionName) {
    //https://yourdomain.atlassian.net/rest/api/3/search
    const url = `${jiraBaseUrl}/search`;
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
    return result.issues.map((issue) => issue.key);
}
