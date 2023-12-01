# Compare jira release issue by release PR

This action extract jira keys from release PR and compare with jira release

## Inputs

- `github-token`: GitHub token.
    - ex) `${{ secrets.GITHUB_TOKEN }}`.
- `jira-token`: Jira API token key (Not Api key)
    - read [Jira Token] section
- `jira-domain`: Domain name (`https://your-domain.atlassian.net`)
- `jira-project`: Jira project name (`HDA`, `ABC`)
- `jira-version-prefix`: Your jira version's prefix name
    - If your versions name is `Customer 1.0.0`, `jira-version-prefix` is `Customer`

### Jira Token

https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/

1. Generate an API token for Jira using your [Atlassian Account](https://id.atlassian.com/manage/api-tokens).
2. Build a string of the form `useremail:api_token`. (ted@prnd.co.kr:xxxxxxx)
3. BASE64 encode the string.

- Linux/Unix/MacOS:

```
echo -n user@example.com:api_token_string | base64
```

- Windows 7 and later, using Microsoft Powershell:

```
$Text = ‘user@example.com:api_token_string’
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
$EncodedText = [Convert]::ToBase64String($Bytes)
$EncodedText
```

## Outputs

- `missing_issue_keys`: Missing jira issue key list

## Example usage

```yaml
name: Jira issue version by release PR
on:
  pull_request:
    types: [ opened, synchronize, ready_for_review ]
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Compare jira release issue by release PR
        id: compare_jira_release_issue
        uses: PRNDcompany/jira-issue-version-by-release-pr@0.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          jira-token: ${{ secrets.JIRA_TOKEN }}
          jira-domain: 'your-domain'
          jira-project: 'ABC'
          jira-version-prefix: 'Customer'
      - name: Print jira issue keys
        run: |
          echo ${{ steps.compare_jira_release_issue.outputs.missing_issue_keys }}
```
