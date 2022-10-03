# frame-annotation-tool
Annotation tool in JavaScript and Node.js for annotation of frames in Dutch documents. Developed within the [Dutch Framenet](http://dutchframenet.nl) project.

### Installation

To install all the required packages, run `npm install`. This will install all dependencies listed in `package.json`. The data for the tool can be obtained from [https://github.com/cltl/DFNDataReleases](https://github.com/cltl/DFNDataReleases), and should be cloned into the `data` directory. Furthermore, the `data` directory should also contain empty JSON files `DynamicLexicon.json`, `Notes.json`, and `Suggestions.json`. The `data` directory should thus look like this:

```
data
|  DynamicLexicon.json     ->    Containing "{}"
|  Notes.json              ->    Containing "{}"
|  Suggestions.json        ->    Containing "{}"
└──DFNDataReleases
   |  ...
```

The root directory of the tool should also contain a file `allowed.json`, which contains a username to password mapping (e.g. `{"sam": "sams_very_secure_password"}`) 

### Starting the server

To start the server, simply run `node tool.js` or `npm start`.

### Tool structure

* `tools.js` is the main Node.js server file containing all backend endpoints and logic for NAF manipulation.
* the `public` directory contains all static frontend code (HTML, Javascript) and static files to be served (images).
  * `public/html/annotation.html` contains all HTML for the annotation page of the tool
  * `public/js/annotation.json` contains all frontend logic and communication with the backend for the annotation page of the tool.
* the `data` directory contains the input data for the tool.

### Acknowledgements

Some functionality was reused from the <a href="https://github.com/cltl/LongTailAnnotation">Long Tail Annotation tool</a>.

### Contact

Sam Titarsolej (s.titarsolej@gmail.com)

Vrije Universiteit Amsterdam
