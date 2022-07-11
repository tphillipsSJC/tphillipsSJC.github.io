require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/layers/GraphicsLayer",
    "esri/Graphic",
    "esri/Basemap",
    "esri/geometry/geometryEngine",
    "esri/geometry/Polygon",
    "esri/widgets/Legend",
    "esri/PopupTemplate",
    "esri/layers/support/LabelClass",
    "esri/symbols/Symbol",
    "esri/widgets/Sketch",
    "esri/geometry/Point",
  ], function (
    esriConfig, 
    Map,
    MapView,
    FeatureLayer,
    GraphicsLayer,            
    Graphic,
    Basemap,             
    geometryEngine,
    Polygon,            
    Legend,
    PopupTemplate,
    LabelClass,
    Symbol,
    Sketch,
    Point,
         ){
    
    esriConfig.apiKey = "AAPK3f3d86d5a3ce469cae866d9372096770ywc8T-ckSUltoEjgvyr5XEGHPH7Dl6CcdxSpGLcgxmhaBi8bPBLyqtO9sKn4av4q"

     const pointGraphic = new Graphic({
       symbol: {
         type: "simple-marker",
         color: [0,0,140],
         outline: {
           color: [255, 255, 255],
           width: .25
         }
       }
     })
     
     const bufferGraphic = new Graphic({
      symbol: {
        type: "simple-fill",
        color: [173, 216, 230, 0],
        outline: {
          color: "darkblue",
          width: 1
        }
      }
    });
     
    const parcelLayer = new FeatureLayer({
      url: "https://www.gis.sjcfl.us/portal_sjcgis/rest/services/Hosted/parcel_info_20220418_dissolve/FeatureServer"}
         );
           
    const addressLayer = new FeatureLayer({
      url: "https://www.gis.sjcfl.us/portal_sjcgis/rest/services/Hosted/Address_Sites/FeatureServer/0"
    })
    
    
    const map = new Map({
      basemap: "topo-vector",
      layers: [parcelLayer, addressLayer],
      showLabels: true,
    });
    
    
    const view = new MapView({
      container: "viewDiv",
      map: map,
      center: [-81.34, 29.94],
      zoom: 16,
      spatialReference: {
        wkid: 3857
      }
    });
    const labelClass = {
      symbol: {
        type: "text",
        color: [85,255,0],
        haloColor: "black",
        haloSize: 1,
        font: {
          family: "Arial",
          size: 14,
          weight: "bold"
        }
      },
      labelExpressionInfo: {
        expression: "$feature.distance + ' ft'"
      }
    };
    
    const propertyLabelClass = {
      symbol: {
        type: "text",
        color: "yellow",
        haloColor: "black",
        haloSize: 1,
        font: {
          family: "Arial",
          size: 14,
          weight: "bold"
        }
      },
      labelExpressionInfo: {
        expression: "$feature.prp_name"
      }
    };
    
    const graphicsLayerSketch = new GraphicsLayer();
    map.add(graphicsLayerSketch);
    
    const sketch = new Sketch({
      layer: graphicsLayerSketch,
      view: view,
      creationMode: "update",
      availableCreateTools: ["point"],
      defaultUpdateOptions: {
         enableScaling: false
        },
      visibleElements: {
        selectionTools: {
          "lasso-selection": false,
          "rectangle-selection": false,          
        },
        undoRedoMenu: false,
        settingsMenu: false
      }
    });
    
    view.ui.add(sketch, "top-right");
    
    sketch.on("update", (event) => {

      const buffer = geometryEngine.geodesicBuffer(event.graphics[0].geometry, 1000, "feet")
      bufferGraphic.geometry = buffer
      bufferGraphic.geometry.spatialReference = map.spatialReference 
      if (event.state === "start"){
        queryFeatures(event.graphics[0].geometry);
        view.graphics.add(bufferGraphic);
      }
      if (event.state === "complete") {
        graphicsLayerSketch.remove(event.graphics[0]);
      }
      if (event.toolEventInfo && (event.toolEventInfo.type === "move-stop")) {
        queryFeatures(event.graphics[0].geometry);
        view.graphics.add(bufferGraphic);
      } 
    }); //End of sketch.onupdate
    
    let distance =1000;
    let units = "feet";
    function queryFeatures(geometry) {          
      parcelLayer.queryFeatures({
        spatialRelationship: "intersects",
        outSpatialReference: view.spatialReference,
        distance: distance,
        units: units,
        geometry: geometry,
        outFields: ["*"],
        returnGeometry: true, 
        where: "use_code IN ('0172','7100','7200','7205','8300','8400')"                 
      }).then((results) => {
        displayResults(results);
      })
       function displayResults(results) {
         const symbol = {
           type: "simple-fill",
           color: [20,130,200,0],
           outline: {
             color: "yellow",
             width: 2
           },
         };
         const popupTemplate = {
           title: "Parcel {pin}",
           content: "Type: {use_desc}"
         };
        
         results.features.map((feature) => {
           feature.symbol = symbol;
           feature.popupTemplate = popupTemplate;
           return feature;
      
           
         });
         sketch.on("update", function(event) {
           const eventInfo = event.toolEventInfo;
           if (eventInfo && eventInfo.type.includes("move")){
             view.graphics.removeMany(results.features);       
           }               
         })
         

         view.popup.close();             
         view.graphics.addMany(results.features);
         //console.log(JSON.stringify(results.features))
         let point = new Point({
           x: geometry.x,
           y: geometry.y,              
         });

           for (let i = 0; i < results.features.length; i++) {
            
              const nearest = geometryEngine.nearestVertices(results.features[i].geometry, point, 1000, 1)

                for (let x = 0; x < Object.keys(nearest).length; x++) {
                   let line = {
                     type: "polyline",
                   paths: [
                     [point.x, point.y],
                     [nearest[x].coordinate.x, nearest[x].coordinate.y],
                     ],
                     spatialReference: view.spatialReference,
                 };
                  var dLinesArr = [];
                  
                 let distanceLines = new Graphic({
                   symbol: {
                     type: "simple-line",
                     color: "green",
                     width: 2
                   },
                   geometry: line,
                   attributes: {
                     "distance" : Math.round(nearest[x].distance)
                   }

                 });
                  dLinesArr.push(distanceLines);
                
                  sketch.on("update", (event) => {
                    if (event.toolEventInfo && (event.toolEventInfo.type === "move-stop")) {
                  view.graphics.remove(distanceLines)
                      
                }
              });
                  
                  view.graphics.addMany([distanceLines]);
                  
                  let fieldName = Object.keys(distanceLines.attributes)
                  
                  
                  let labelLayer = new FeatureLayer({
                    fields: [
                      {
                        name: "ObjectID",
                        type: "oid"
                      },
                      {
                        name: fieldName,
                        type: "double"
                      }
                    ],
                    
                    labelIsVisible: true,
                    source: dLinesArr,
                    objectIdField: "ObjectID",
                    labelingInfo: [labelClass],
                    spatialReference: { wkid: 4326},
                    renderer: {
                      type: "simple",
                      symbol: {
                        type: "simple-fill",
                        size: 0,
                        color: [0,0,0,0.0]
                      }
                    }
                  });
                  map.layers.remove([labelLayer]);
                  map.add(labelLayer);
                  
                  let propertyLabels = new FeatureLayer({
                    fields: [
                      {
                        name: "ObjectID",
                        type: "oid"
                      },
                      {
                        name: "prp_name",
                        type: "string"
                      }
                    ],
                    
                    labelIsVisible: true,
                    source: [results.features[i]],
                    objectIdField: "ObjectID",
                    labelingInfo: [propertyLabelClass],
                    spatialReference: { wkid: 4326},
                    renderer: {
                      type: "simple",
                      symbol: {
                        type: "simple-fill",
                        size: 0,
                        color: [0,0,0,0.0]
                      }
                    }
                  });
                  map.layers.remove([propertyLabels]);
                  map.add(propertyLabels);
                  console.log(JSON.stringify(propertyLabels))
                  const distanceLineEdits = {
                    updateFeatures: dLinesArr
                  };
                  
                  const propertyLabelsEdits = {
                    updateFeatures: [results.features[i]]
                  }
                  
                  applyEditsToLayerDistanceLines(distanceLineEdits);
                  applyEditsToLayerPropertyLabels(propertyLabelsEdits);
                  
                  function applyEditsToLayerDistanceLines(distanceLineEdits) {
                    labelLayer.applyEdits(distanceLineEdits).then((results) => {
                      if (results.deleteFeatureResults.length > 0) {
                        console.log(results.deleteFeatureResults.length, "features have been removed")
                      };
                      if (results.addFeatureResults.length > 0) {
                        const objectIds = [];
                        results.addFeatureResults.forEach((item) => {
                          objectIds.push(item.objectId);
                        });
                        labelLayer.queryFeatures({
                          objectIds: objectIds
                        }).then((results) => {
                          console.log(results.features.length, "features have been added")
                        });
                      }
                    })
                  }
                 
                  function applyEditsToLayerPropertyLabels(propertyLabelsEdits) {
                    propertyLabels.applyEdits(propertyLabelsEdits).then((results) => {
                      if (results.deleteFeatureResults.length > 0) {
                        console.log(results.deleteFeatureResults.length, "properties have been removed")
                      };
                      if (results.addFeatureResults.length > 0) {
                        const objectIds = [];
                        results.addFeatureResults.forEach((item) => {
                          objectIds.push(item.objectId);
                        });
                        propertyLabels.queryFeatures({
                          objectIds: objectIds
                        }).then((results) => {
                          console.log(results.features.length, "properties have been added")
                        });
                      }
                    })
                  }
                  
                
                  
                  sketch.on("delete", function (event) {
                    view.graphics.removeAll();
                    map.layers.remove(labelLayer)
                    map.layers.remove(propertyLabels)
                    });
                  sketch.on("update", (event) => {
                    if (event.toolEventInfo && (event.toolEventInfo.type === "move-stop")) {
                    map.layers.remove(labelLayer)
                    map.layers.remove(propertyLabels)
                      
                }
              });
              }     
    
    
            }; //end of for loop
         
         }
    };
    
    
    
    
    
   
    
}); //End of function displayResults 