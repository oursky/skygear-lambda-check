'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const exec = require('child_process').exec;
const webhookUrl = process.env.SLACK_WEBHOOK_URL;
const accessToken = process.env.ACCESS_TOKEN;

// Constants
const PORT = 8080;

// App
const app = express();

app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.send('GET request');
});

app.post('/', function (req, res) {
  res.send('POST request');
  const postRequest = req.body;
  let compareUrl = postRequest.repository.compare_url.replace(
    '{base}',
    postRequest.before
  );
  compareUrl = compareUrl.replace('{head}', postRequest.after);
  if (!vaildateURL(compareUrl)) {
    return;
  }
  compareUrl = escapeURL(compareUrl);
  const cmd = 'curl ' + compareUrl + '?access_token=' + accessToken;
  const filesUrls = [];
  const downloadUrls = [];
  let htmlUrl = '';
  exec(cmd, function(error, stdout, stderr) {
    const out = JSON.parse(stdout);
    htmlUrl = out.html_url;
    out.files.map(file => {
      const fileName = file.filename;
      const extName = fileName.substr(fileName.length - 3)
      if (extName === '.py' || extName === '.js') {
        let grepCmd = '';
        if (extName === '.py') {
          grepCmd = 'printf "' + file.patch + '" | grep -e @skygear.op';
        } else {
          grepCmd = 'printf "' + file.patch + '" | fgrep skygearCloud.op\\(';
        }
        console.log('grepCmd', grepCmd);
        exec(grepCmd, function(error, stdout, stderr) {
          let newFunctionName = '';
          const functionNames = stdout.split(/\r?\n/);
          console.log('functionNames', functionNames);
          functionNames.map(name => {
            if (name[0] === '+') {
              newFunctionName += name + '\n';
            }
          });
          if (newFunctionName !== '') {
            let payload = {
              text : 'Filename: ' + fileName +
                '\n Function Name: ' + newFunctionName +
                '\n URL: ' + htmlUrl
            };
            payload = JSON.stringify(payload);
            console.log('payload', payload);
            const postSlackCmd = "curl -X POST --data-urlencode 'payload=" +
              payload + "' " + webhookUrl;
            exec(postSlackCmd, function(error, stdout, stderr) {
            });
          }
        });
      }
    });
  });
});

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);

function vaildateURL(url) {
  const domain = 'github.com';
  let pat = '^https?://(?:[^/@:]*:[^/@]*@)?(?:[^/:]+\.)?' + domain + '(?=[/:]|$)';
  let re = new RegExp(pat, 'i');
  return re.test(url);
}

function escapeURL(url) {
  if (url.indexOf('"') >= 0) {
    url = url.replace('"', '\\"');
  }
  return '"' + url + '"';
}

