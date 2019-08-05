#!/usr/bin/env node

'use strict';

const chalk = require('chalk');
const commander = require('commander');
const envinfo = require('envinfo');
const execSync = require('child_process').execSync;
const fs = require('fs-extra');
const path = require('path');
const validateProjectName = require('validate-npm-package-name');

const tmpFileDir = 'ahaNoRepeat'
const packageJson = require('./package.json');

let projectName;
const program = new commander.Command(packageJson.name)
  .version(packageJson.version)
  .arguments('<project-directory>')
  .usage(`${chalk.green('<project-directory>')} [options]`)
  .action(name => {
    projectName = name;
  })
  .option('--verbose', 'print additional logs')
  .option('--info', 'print environment debug info')
  .option('-T, --template', '模板地址')
  .option('--update', '更新项目到最新模板')
  .option('--debug', 'debug')
  .allowUnknownOption()
  //   .on('--help', () => {
  //     console.log(`    Only ${chalk.green('<project-directory>')} is required.`);
  //     console.log();
  //     console.log(
  //       `    A custom ${chalk.cyan('--scripts-version')} can be one of:`
  //     );
  //     console.log(`      - a specific npm version: ${chalk.green('0.8.2')}`);
  //     console.log(`      - a specific npm tag: ${chalk.green('@next')}`);
  //     console.log(
  //       `      - a custom fork published on npm: ${chalk.green(
  //         'my-react-scripts'
  //       )}`
  //     );
  //     console.log(
  //       `      - a local path relative to the current working directory: ${chalk.green(
  //         'file:../my-react-scripts'
  //       )}`
  //     );
  //     console.log(
  //       `      - a .tgz archive: ${chalk.green(
  //         'https://mysite.com/my-react-scripts-0.8.2.tgz'
  //       )}`
  //     );
  //     console.log(
  //       `      - a .tar.gz archive: ${chalk.green(
  //         'https://mysite.com/my-react-scripts-0.8.2.tar.gz'
  //       )}`
  //     );
  //     console.log(
  //       `    It is not needed unless you specifically want to use a fork.`
  //     );
  //     console.log();
  //     console.log(
  //       `    If you have any problems, do not hesitate to file an issue:`
  //     );
  //     console.log(
  //       `      ${chalk.cyan(
  //         'https://github.com/facebook/create-react-app/issues/new'
  //       )}`
  //     );
  //     console.log();
  //   })
  .parse(process.argv);

if (program.info) {
  console.log(chalk.bold('\nEnvironment Info:'));
  return envinfo
    .run(
      {
        System: ['OS', 'CPU'],
        Binaries: ['Node', 'npm', 'Yarn'],
        Browsers: ['Chrome', 'Edge', 'Internet Explorer', 'Firefox', 'Safari'],
        npmPackages: ['react', 'react-dom', 'react-scripts'],
        npmGlobalPackages: ['create-react-app'],
      },
      {
        duplicates: true,
        showNotFound: true,
      }
    )
    .then(console.log);
}

if (typeof projectName === 'undefined' && !program.update) {
  console.error('Please specify the project directory:');
  console.log(
    `  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`
  );
  console.log();
  console.log('For example:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('my-react-app')}`);
  console.log();
  console.log(
    `Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`
  );
  process.exit(1);
}
let template = program.template || 'git@git.koolearn-inc.com:zhaoshichao/project-tpl.git'

function printValidationResults(results) {
  if (typeof results !== 'undefined') {
    results.forEach(error => {
      console.error(chalk.red(`  *  ${error}`));
    });
  }
}

let originalCwd = process.cwd()
process.on('uncaughtException', err => {
  console.error('some error')
  console.error(err)
  fs.removeSync(path.resolve(originalCwd, projectName))
})

createApp(
  projectName,
  program.verbose,
  template,
  program.update
);

function createApp(
  name = '',
  verbose,
  template,
  isUpdate,
) {
  const root = path.resolve(name);
  const appName = path.basename(root);
  console.log(root, appName, template)
  checkAppName(appName);

  console.log(`Creating a new React app in ${chalk.green(root)}.`);
  console.log();
  if (!program.debug && !isUpdate) {
    fs.mkdirSync(root)
  }

  const useYarn = shouldUseYarn();
  process.chdir(root);
  if (!program.debug) {
    execSync(`git clone ${template} ${tmpFileDir}`, { stdio: 'inherit' })
  }
  fs.removeSync(`./${tmpFileDir}/.git`)

  if (!isUpdate) {// 创建
    fs.copySync(`./${tmpFileDir}`, './')
    let packageObj = fs.readJsonSync('./package.json')
    packageObj.name = appName
    packageObj.version = '0.1.0'
    fs.writeJsonSync(path.join(root, 'package.json'), packageObj)
  } else { // 更新
    let updateFileList = ['config', '.editorconfig', '.eslintrc.js', 'babel.config.js', 'jsconfig.json', 'package.json', 'postcss.config.js']
    updateFileList.forEach(file => {
      fs.copySync(`./${tmpFileDir}/${file}`, `./${file}`)
    })
  }
  // 安装
  if (!program.debug) {
    execSync(`${useYarn ? 'yarn --ignore-engines' : 'npm'} install`, { stdio: 'inherit' })
    cleanup()
    console.log(chalk.green('OK'))
  }
}

function shouldUseYarn() {
  try {
    execSync('yarn --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function checkAppName(appName) {
  const validationResult = validateProjectName(appName);
  if (!validationResult.validForNewPackages) {
    console.error(
      `Could not create a project called ${chalk.red(
        `"${appName}"`
      )} because of npm naming restrictions:`
    );
    printValidationResults(validationResult.errors);
    printValidationResults(validationResult.warnings);
    process.exit(1);
  }

  // TODO: there should be a single place that holds the dependencies
  const dependencies = ['react', 'react-dom', 'react-scripts'].sort();
  if (dependencies.indexOf(appName) >= 0) {
    console.error(
      chalk.red(
        `We cannot create a project called ${chalk.green(
          appName
        )} because a dependency with the same name exists.\n` +
        `Due to the way npm works, the following names are not allowed:\n\n`
      ) +
      chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
      chalk.red('\n\nPlease choose a different project name.')
    );
    process.exit(1);
  }
}

function cleanup() {
  fs.removeSync(`./${tmpFileDir}`)
}
