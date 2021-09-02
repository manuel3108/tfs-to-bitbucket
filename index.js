#!/usr/bin/env node
import fetch from 'node-fetch';
import { exec, execSync } from 'child_process';
import * as fs from 'fs';
import { config } from 'dotenv';

const tfsApiRepoList = '/_apis/git/repositories';
const tfsDir = 'tfs';

async function start() {
    // load environment
    config();

    console.log('Getting list of projects...');
    let tfsProjects = await getTfsProjectList();
    console.log('Found ' + tfsProjects.length + ' projects!');

    for (let i = 0; i < tfsProjects.length; i++) {
        const tfsProject = tfsProjects[i];

        console.log(
            `${getLogInfo(i, tfsProjects.length)} Cloning repo \"${
                tfsProject.name
            }\"...`
        );
        await gitClone(tfsProject.remoteUrl, tfsProject.name);

        console.log(`${getLogInfo(i, tfsProjects.length)} Creating repo...`);
        const repoUrl = await createNewProject(tfsProject.name);

        console.log(`${getLogInfo(i, tfsProjects.length)} Changing remote...`);
        await setRemoteUrl(tfsProject.name, repoUrl);

        console.log(
            `${getLogInfo(i, tfsProjects.length)} Pushing to remote...`
        );
        await pushToRemote(tfsProject.name);
    }
}

async function pushToRemote(name) {
    await execSync(`git --git-dir "${tfsDir}/${name}" push --mirror origin`);
}

async function setRemoteUrl(name, repoUrl) {
    await execSync(
        `git --git-dir "${tfsDir}/${name}" remote set-url origin ${repoUrl}`
    );
}

async function createNewProject(name) {
    const repoName = name
        .toLowerCase()
        .replaceAll('%20', '')
        .replaceAll(' ', '');
    const response = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${process.env.BITBUCKET_REPO_OWNER}/${repoName}`,
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization:
                    'Basic ' +
                    btoa(
                        `${process.env.BITBUCKET_USER}:${process.env.BITBUCKET_PASSWORD}`
                    ),
            },
            method: 'POST',
            body: JSON.stringify({
                scm: 'git',
                is_private: true,
            }),
        }
    );
    const json = await response.json();
    const newRepoUrl = json.links.clone[0].href;
    return newRepoUrl;
}

function getLogInfo(index, maxLength) {
    var date = new Date();
    return `[${index + 1}/${maxLength} ${date.toLocaleTimeString()}]`;
}

async function gitClone(url, name) {
    if (!fs.existsSync(tfsDir)) {
        fs.mkdirSync(tfsDir);
    }

    const newUrl = url.replace(
        'https://',
        `https://${process.env.TFS_USERNAME}:${process.env.TFS_PASSWORD}@`
    );
    await execSync(`git clone --mirror ${newUrl} "${tfsDir}/${name}"`);
}

async function getTfsProjectList() {
    const response = await fetch(process.env.TFS_URL + tfsApiRepoList, {
        headers: {
            Authorization:
                'Basic ' +
                btoa(`${process.env.TFS_USERNAME}:${process.env.TFS_PAT}`),
        },
    });
    const json = await response.json();
    return json.value;
}

start();
