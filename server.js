var express = require('express');
var app = express();
var multer  = require('multer');
var upload = multer({ dest: __dirname + '/public/images/' })
var rp = require('request-promise-native');
const querystring = require('querystring');
const url = require('url')

const gcpApiUrl = 'https://vision.googleapis.com/v1/images:annotate?'
const GCP_API_KEY = process.env.GCP_API_KEY;

const projectUrl = 'https://' + process.env.PROJECT_DOMAIN + '.glitch.me';
const redirectPath = '/b';
const stateString = 'abc123';

const spotifyApiUrl = '	https://api.spotify.com/v1/';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = projectUrl + redirectPath;
var spotifyToken = '';

function postGcpVision(imagePath, req, res) {
  
  var guess = "";
  let gcpVisionOptions = {
    method: 'POST',
    uri: gcpApiUrl + 'key=' + GCP_API_KEY,
    body: {
      "requests":[
        {
          "image":{
            "source": {
              "imageUri": projectUrl + imagePath
            }
          },
          "features":[
            {
              "type":"WEB_DETECTION",
              "maxResults":1
            }
          ]
        }
      ]
    },
    json: true // Automatically stringifies the body to JSON
  };
 
  rp(gcpVisionOptions)
  .then(function (parsedBody) {
    console.log(JSON.stringify(parsedBody));
    guess = parsedBody.responses[0].webDetection.bestGuessLabels[0].label;
    console.log(guess);
  })
  .then(function () {
    let spotifyOptions = {
      method: 'GET',
      uri: spotifyApiUrl + 'search?q=' + guess + '&type=Album',
      json: true,
      auth: {
          'bearer': spotifyToken
      }
    } 
    
    rp(spotifyOptions)
    .then(function(spotifyData) {
      let url = spotifyData.albums.items[0].external_urls.spotify;
      //res.send("<a href='" + url + "' target='_blank'>" + url + "</a>");
      res.redirect(url);
    })
    .catch(function(err) {
      console.log("SpotifyError");
      throw(err);
    });
    
  })
  .catch(function (err) {
    console.log("GCP Error");
    console.log(err);
    res.send(err);
  });
}





app.use(express.static('public'));


app.get('/', (req, res) => {
  res.redirect('/auth');
});


app.get('/player', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.post('/player', upload.single('file'), function(req, res) {
  //res.send(req.file);
  let imagePath = "/images/" + req.file.filename;
  //res.send("<img src=" + imagePath + "'>");
  postGcpVision(imagePath, req, res);
});

app.get('/auth', (req, res) => {
  let query = {
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: stateString,
    show_dialog: false
  }
  
  res.redirect("https://accounts.spotify.com/authorize?" + querystring.stringify(query));
});

app.get('/b', (req, res) => {
  if (req.query.state === stateString && !req.query.error) {
    var code = req.query.code;
    
    var spotifyAuthOptions = {
      method: 'POST',
      uri: 'https://accounts.spotify.com/api/token',
      form: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET,
      },
      json: true
    }
    
    rp(spotifyAuthOptions)
    .then(data => {
      console.log("access_token: " + data.access_token);
      console.log("token_type: " + data.token_type);
      console.log("scope: " + data.scope);
      console.log("expires_in: " + data.expires_in);
      console.log("refresh_token: " + data.refresh_token);
      spotifyToken = data.access_token
      res.redirect('/player');
    })
    .catch(err => {
      res.send(err.message);
    });
  } else {
   res.send("Error: " + req.query.error);     
  }
});


var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});