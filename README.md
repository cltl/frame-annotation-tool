# frame-annotation-tool
Annotation tool in JavaScript and Node.js for annotation of frames in Dutch documents. Developed within the [Dutch Framenet](http://dutchframenet.nl) project.

### Installation

To install all the needed packages, please run `npm install`. This will install all dependencies listed in `package.json`.

### Starting the server

To start the server, simply run `node server.js` or `npm start`.

### Directory structure

* `server.js` is the main Node.js server file.
* the folder `public` contains all static code (HTML, Javascript) and static files to be served (images and PDF files).
* the filder `data` contains the input data for the tool. Specifically, it contains all the *.bin files and a `naf` folder that contains the NAF files. It also contains the `inc2doc_index.json` file that we create with the `scripts/`.
* `scripts` has loading scripts that prepare the data for the tool.
* the tool documentation can be found in `docs`.

### Acknowledgements

Some functionality was copied from the <a href="https://github.com/cltl/LongTailAnnotation">Long Tail Annotation tool</a>.

### Contact
Filip Ilievski (f.ilievski@vu.nl)

Vrije Universiteit Amsterdam
