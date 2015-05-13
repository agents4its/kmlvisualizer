/*global define*/
define([
        '../../Core/defaultValue',
		'../../Core/Color',
        '../../Core/defined',
        '../../Core/defineProperties',
        '../../Core/DeveloperError',
        '../../Core/Event',
        '../../Core/wrapFunction',
        '../../DataSources/CzmlDataSource',
        '../../DataSources/GeoJsonDataSource',
        '../../DataSources/KmlDataSource',
        '../getElement',
		'../../../spin',
		'../../Scene/PerformanceDisplay',
		'../../../jssaxparser/DefaultHandlers',
		'../../../jssaxparser/sax',
		'../../../Apps/Sandcastle/Sandcastle-header'
    ], function(
        defaultValue,
		Color,
        defined,
        defineProperties,
        DeveloperError,
        Event,
        wrapFunction,
        CzmlDataSource,
        GeoJsonDataSource,
        KmlDataSource,
        getElement,
		Spinner
		,PerformanceDisplay,
		DefaultHandlers,
		sax,
		Sandcastle) {
    "use strict";

	var opts = {
		lines: 10, // The number of lines to draw
		length: 7, // The length of each line
		width: 4, // The line thickness
		radius: 10, // The radius of the inner circle
		corners: 1, // Corner roundness (0..1)
		rotate: 0, // The rotation offset
		color: '#FFFFE0', // #rgb or #rrggbb
		speed: 1, // Rounds per second
		trail: 60, // Afterglow percentage
		shadow: false, // Whether to render a shadow
		hwaccel: true, // Whether to use hardware acceleration
		className: 'spinner', // The CSS class to assign to the spinner
		zIndex: 2e9, // The z-index (defaults to 2000000000)
		top: '50%', // Top position relative to parent in px
		left: '50%' // Left position relative to parent in px
	};
	var interval;
	var saxParser;
	var intervalKmz;
	var spinner;
	var performanceContainer;
	var viewer;
	var kmlFiles = 0;
    /**
     * A mixin which adds default drag and drop support for CZML files to the Viewer widget.
     * Rather than being called directly, this function is normally passed as
     * a parameter to {@link Viewer#extend}, as shown in the example below.
     * @exports viewerDragDropMixin
     *
     * @param {Viewer} viewer The viewer instance.
     * @param {Object} [options] Object with the following properties:
     * @param {Element|String} [options.dropTarget=viewer.container] The DOM element which will serve as the drop target.
     * @param {Boolean} [options.clearOnDrop=true] When true, dropping files will clear all existing data sources first, when false, new data sources will be loaded after the existing ones.
     * @param {DefaultProxy} [options.proxy] The proxy to be used for KML network links.
     *
     * @exception {DeveloperError} Element with id <options.dropTarget> does not exist in the document.
     * @exception {DeveloperError} dropTarget is already defined by another mixin.
     * @exception {DeveloperError} dropEnabled is already defined by another mixin.
     * @exception {DeveloperError} dropError is already defined by another mixin.
     * @exception {DeveloperError} clearOnDrop is already defined by another mixin.
     *
     * @example
     * // Add basic drag and drop support and pop up an alert window on error.
     * var viewer = new Cesium.Viewer('cesiumContainer');
     * viewer.extend(Cesium.viewerDragDropMixin);
     * viewer.dropError.addEventListener(function(viewerArg, source, error) {
     *     window.alert('Error processing ' + source + ':' + error);
     * });
     */
    var viewerLoadFileMixin = function(widget) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(widget)) {
            throw new DeveloperError('viewer is required.');
        }
        //>>includeEnd('debug');
		viewer = widget;
		
		document.querySelector("#fileInput").addEventListener('change',handleFiles);
    };
	
	function handleFiles(){
		var file = document.getElementById('fileInput').files[0];		
		var reader = new FileReader();
		reader.onload = createOnLoadCallback(viewer,file);
		reader.readAsText(file);
	}
	
	function onFileReadComplete(evt) { 
		console.log(evt.target.result);
	}

    function createOnLoadCallback(viewer, file) {
        return function(evt) {
            var fileName = file.name;
            try {
                var loadPromise;
				var dataSource;

                if (/\.czml$/i.test(fileName)) {
                    loadPromise = CzmlDataSource.load(JSON.parse(evt.target.result), {
                        sourceUri : fileName
                    });
                } else if (/\.geojson$/i.test(fileName) || /\.json$/i.test(fileName) || /\.topojson$/i.test(fileName)) {
                    loadPromise = GeoJsonDataSource.load(JSON.parse(evt.target.result), {
                        sourceUri : fileName
                    });
                } else if (/\.(kml|kmz)$/i.test(fileName)) {
					var target = document.getElementById('cesiumContainer');
					spinner = new Spinner().spin(target);
					
					performanceContainer = document.createElement('div');
					performanceContainer.className = 'cesium-loadingKML';
					performanceContainer.style.position = 'absolute';
					performanceContainer.style.top = '0';
					performanceContainer.style.left = '0';
					performanceContainer.style.right = '0';
					performanceContainer.style.bottom = '0';
					var container = document.body;
					container.appendChild(performanceContainer);
					performanceContainer.style.backgroundColor = 'rgba(40, 40, 40, 0.7)';
					
					var display = document.createElement('div');
					var fpsElement = document.createElement('div');
					var fpsText = document.createTextNode("Loading...");
					fpsElement.appendChild(fpsText);
					fpsElement.style.color = "#FFFF00";
					display.appendChild(fpsElement);
					display.style['z-index'] = 1;
					display.style.top ='48%';
					display.style.left = '52%';
					display.style.position = 'absolute';
					display.style.font = this._font;
					display.style.padding = '7px';
					display.style['border-radius'] = '5px';
					display.style.border = '1px solid #444';
					performanceContainer.appendChild(display);
					fpsText.nodeValue = 'Loading...';
					
					var contentHandler = new DefaultHandler2();
					var dataSource = new KmlDataSource();
					contentHandler.setDataSource(dataSource);

					saxParser = XMLReaderFactory.createXMLReader();
					saxParser.setHandler(contentHandler);
					//dataSource._viewer = viewer;
					
					if (/\.kmz$/i.test(fileName)){
						dataSource.loadKmz(dataSource,file,fileName);
						intervalKmz = setInterval( function () {startParsingKmz(dataSource);},10);
						interval = setInterval( function () {showMessage(dataSource,viewer,file)},10);
						return;
					}
					setTimeout( function() {
						saxParser.parseString(evt.target.result);
					},0);
                } else {
                    viewer.dropError.raiseEvent(viewer, fileName, 'Unrecognized file: ' + fileName);
                    return;
                }
				
				interval = setInterval( function () {showMessage(dataSource,viewer,file)},10);

                if (defined(loadPromise)) {
                    loadPromise.otherwise(function(error) {
                        viewer.dropError.raiseEvent(viewer, fileName, error);
                    });
                }
            } catch (error) {
                viewer.dropError.raiseEvent(viewer, fileName, error);
            }
        };
    }
	function startParsingKmz(dataSource){
		if (defined(dataSource._uriResolver) && defined(dataSource._uriResolver.kml)) {
			clearInterval(intervalKmz);
			clearInterval(intervalKmz-1);
			saxParser.parseString(dataSource._uriResolver.kml);
		}
	}
	function showMessage(dataSource,viewer,file){
		if(dataSource.isEnd){
		 // dataSource.entities.resumeEvents();
   // dataSource._changed.raiseEvent(dataSource);
			createCheckBox(file);
			viewer.dataSources.add(dataSource);
			clearInterval(interval);
			clearInterval(interval-1);
			spinner.stop();
			document.body.removeChild(performanceContainer);
		}
	}
	
	function createCheckBox(file){
		var display = document.getElementById('checkBoxList');
		if (!display) {
			//show translucency button
			document.getElementsByClassName('cesium-button')[10].style.display = 'initial';
			display = document.createElement('checkBoxList');
			display.style.backgroundColor = 'rgba(40, 40, 40, 0.7)';
			display.style.padding = '7px';
			display.style['border-radius'] = '5px';
			display.style.border = '1px solid #444';
			display.style.marginTop = '5px'
			document.getElementById('toolbar').appendChild(display);
			display.style.display = "block";
			display.id = "checkBoxList";
		}
		var div = document.createElement('div');
		var checkBox = document.createElement("INPUT");
		checkBox.setAttribute("type", "checkbox");
		
		div.style.display = "block";
		
		if (!document.getElementById(file.name)){
			checkBox.id = kmlFiles;
			kmlFiles++;
			
			var newlabel = document.createElement("Label");
			newlabel.setAttribute("for",kmlFiles-1);
			newlabel.innerHTML = file.name;
			
			div.appendChild(checkBox);
			div.appendChild(newlabel);
			display.appendChild(div);

			checkBox.checked = true;
		}
	}

    function createDropErrorCallback(viewer, file) {
        return function(evt) {
            viewer.dropError.raiseEvent(viewer, file.name, evt.target.error);
        };
    }

    return viewerLoadFileMixin;
});