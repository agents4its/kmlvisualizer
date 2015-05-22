# KML Visualizer
Web-based interactive visualization tool for **KML** files with very high number of moving placemarks. The visualizer is built on  [Cesium WebGL Virtual Globe](http.cesiumjs.org).


## About
<img src="https://raw.github.com/agents4its/kmlvisualizer/screenshots/layer.PNG" width="350" align="right" /><br>
- Designed for a large number of gx:Track elements.
- KML parsing using [SAX](https://github.com/ndebeiss/jsxmlsaxparser) parser.
- Load KML files in layers.
- Convenient alternative to Google Earth for when you need to animate many elements at once.

## Usage
<img src="https://raw.github.com/agents4its/kmlvisualizer/screenshots/translucency.JPG" width="350" align="right" /><br>
- Make sure that your browser supports [WebGL](http://get.webgl.org/).
- Go to [http://agents4its.github.io/kmlvisualizer/](http://agents4its.github.io/kmlvisualizer/). Then drag-and-drop your KML or KMZ files onto the screen (or click on "LOAD KML" in the top-left corner).
- Alternatively: Run a local web server, download the [latest source code release](https://github.com/agents4its/kmlvisualizer/releases/) and browse to index.html on your localhost.


