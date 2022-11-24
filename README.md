# frame-annotation-tool
Annotation tool in JavaScript and Node.js for annotation of frames in Dutch documents. Developed within the [Dutch Framenet](http://dutchframenet.nl) project.

## Installation
To install all the required packages, run `npm install`. This will install all dependencies listed in `package.json`. The data for the tool can be obtained from [https://github.com/cltl/DFNDataReleases](https://github.com/cltl/DFNDataReleases), and should be cloned into the `data` directory. Furthermore, the `data` directory should also contain empty JSON files `DynamicLexicon.json`, `Notes.json`, and `Suggestions.json`. The `data` directory should thus look like this:

```
data
|  allowed.json            ->    Containing user -> password mapping
|  DynamicLexicon.json     ->    Containing "{}"
|  Notes.json              ->    Containing "{}"
|  Suggestions.json        ->    Containing "{}"
└──DFNDataReleases
   |  ...
```

`data/allowed.json` should contain a username to password mapping (e.g. `{"sam": "sams_very_secure_password"}`) 

## Deploying the server

### Locally
To start the annotation server locally, simply run `node tool.js` or `npm start`. Open `localhost:8787` in your favorite browser to start annotating.

### Using pm2
For deployment on a server, deployment using a process manager such as [pm2](https://pm2.keymetrics.io/) is recommended. Install the pm2 and run `pm2 start tool.js` to the annotation server.

### Using docker
Alternatively deployment using docker is possible. First, run `docker pull ghcr.io/cltl/frame-annotation-tool:latest` to pull the docker image on your server. Create a data directory on the server containing all the required data. Start the annotation server by running `docker run ghcr.io/cltl/frame-annotation-tool:latest --mount type=bind,source=/path/to/data/directory,target=/usr/data --env TOOL_DATA_DIR=/usr/data -p 8787:8787`.

## Tool structure

* `tools.js` is the main Node.js server file containing all backend endpoints and logic for NAF manipulation.
* the `public` directory contains all static frontend code (HTML, Javascript) and static files to be served (images).
  * `public/html/annotation.html` contains all HTML for the annotation page of the tool
  * `public/js/annotation.json` contains all frontend logic and communication with the backend for the annotation page of the tool.
* the `data` directory contains the input data for the tool.

## Acknowledgements
Some functionality was reused from the <a href="https://github.com/cltl/LongTailAnnotation">Long Tail Annotation tool</a>.

## Contact
Sam Titarsolej (s.titarsolej@gmail.com)

Vrije Universiteit Amsterdam
