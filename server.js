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
  let compareUrl = postRequest.repository.compare_url.replace('{base}', postRequest.before);
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
    // command output is in stdout
    console.log('stdout', stdout);
    const out = JSON.parse(stdout);
    htmlUrl = out.html_url;
    out.files.map(file => {
      const fileName = file.filename;
      if (fileName.substr(fileName.length - 3) === '.py' || fileName.substr(fileName.length - 3) === '.js') {
        const curlContentCmd = 'curl --header \"Authorization: token ' + accessToken + '\" ' + file.contents_url;
        exec(curlContentCmd, function(error, stdout, stderr) {
          const contentOut = JSON.parse(stdout);
          let curlDownloadCmd = '';
          if (file.filename.substr(file.filename.length - 3) === '.py') {
            curlDownloadCmd = 'curl --header \"Authorization: token ' + accessToken + '\" ' + contentOut.download_url + '| grep -e @skygear.op -e @op';
          } else {
            curlDownloadCmd = 'curl --header \"Authorization: token ' + accessToken + '\" ' + contentOut.download_url  + '| fgrep .op\\(';
          }
          exec(curlDownloadCmd, function(error, stdout, stderr) {
            if (!stdout) {
              return;
            }
            let payload = {text : 'Filename: ' + fileName + '\n Function Name: ' + stdout + '\n URL: ' + htmlUrl};
            payload = JSON.stringify(payload);
            const postSlackCmd = "curl -X POST --data-urlencode 'payload=" + payload + "' " + webhookUrl;
            exec(postSlackCmd, function(error, stdout, stderr) {
            });
          });
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

