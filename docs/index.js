const {DeckGL, GeoJsonLayer, TextLayer, ScatterplotLayer} = deck;

const COLOR_SCALE = [
    [240, 240, 240],
    // positive
    [255, 255, 204],
    [255, 237, 160],
    [254, 217, 118],
    [254, 178, 76],
    [253, 141, 60],
    [252, 78, 42],
    [227, 26, 28],
    [189, 0, 38],
    [128, 0, 38]
];

//zip.workerScriptsPath = "./js/";
zip.workerScripts = {
    deflater: ['./js/z-worker.js', './js/pako/pako_deflate.min.js', './js/pako/codecs.js'],
    inflater: ['./js/z-worker.js', './js/pako/pako_inflate.min.js', './js/pako/codecs.js']
  };

function isInt(n){
    return Number(n) === n && n % 1 === 0;
}

class GeodaProxy {
    // file_target is evt.target
    constructor() {
        this.geojson_maps = {};
    }
  
    ReadGeojsonMap(map_uid, file_target) {
        //evt.target.result is an ArrayBuffer. In js, 
        const uint8_t_arr = new Uint8Array(file_target.result);
        //First we need to allocate the wasm memory. 
        const uint8_t_ptr = window.Module._malloc(uint8_t_arr.length);
        //Now that we have a block of memory we can copy the file data into that block
        window.Module.HEAPU8.set(uint8_t_arr, uint8_t_ptr);
        // pass the address of the wasm memory we just allocated to our function
        //window.Module.new_geojsonmap(map_uid, uint8_t_ptr, uint8_t_arr.length);
        window.Module.ccall("new_geojsonmap1", null, ["string", "number", "number"], [map_uid, uint8_t_ptr, uint8_t_arr.length]);

        //Lastly, according to the docs, we should call ._free here.
        window.Module._free(uint8_t_ptr);
        // store the map and map type
        let map_type = Module.get_map_type(map_uid);
        this.geojson_maps[map_uid] = map_type;
    return map_uid;
    }
 
    Has(map_uid) {
        return map_uid in this.geojson_maps;
    }

    GetCentroids(map_uid) {
        let cc = Module.get_centroids(map_uid);
        let xx = cc.get_x();
        let yy  = cc.get_y();
        var centroids = [];
        for (let i=0; i<xx.size(); ++i) {
            centroids.push([xx.get(i), yy.get(i)]);
        }
        return centroids;
    }

    GetNumObs(map_uid) {
      let n = Module.get_num_obs(map_uid);
      return n;
    }
  
    GetMapType(map_uid) {
      return this.geojson_maps[map_uid];
    }
  
    GetNumericCol(map_uid, col_name) {
      // return VectorDouble
      return Module.get_numeric_col(map_uid, col_name)
    }
  
    CreateRookWeights(map_uid, order, include_lower_order, precision) {
      let w_uid = Module.rook_weights(map_uid, order, include_lower_order, precision);
      return w_uid;
    }

    CreateQueenWeights(map_uid, order, include_lower_order, precision) {
      let w_uid = Module.queen_weights(map_uid, order, include_lower_order, precision);
      return w_uid;
    }

    GetMinDistThreshold(map_uid, is_arc, is_mile) {
      let val = Module.min_distance_threshold(map_uid, is_arc, is_mile);
      return val;
    }

    CreateKnnWeights(map_uid, k, power, is_inverse, is_arc, is_mile) {
      let w = Module.knn_weights(map_uid, k, power, is_inverse, is_arc, is_mile);
      return w;
    }

    CreateDistWeights(map_uid, dist_thres, power, is_inverse, is_arc, is_mile) {
      let w = Module.dist_weights(map_uid, dist_thres, power, is_inverse, is_arc, is_mile);
      return w;
    }

    CreateKernelWeights(map_uid, k, kernel, adaptive_bandwidth, use_kernel_diagonals, is_arc, is_mile) {
      let w = Module.kernel_weights(map_uid, k, kernel, adaptive_bandwidth, use_kernel_diagonals, is_arc, is_mile);
      return w;
    }

    CreateKernelBandwidthWeights(map_uid, dist_thres, kernel, use_kernel_diagonals, is_arc, is_mile) {
      let w = Module.kernel_bandwidth_weights(map_uid, dist_thres, kernel, use_kernel_diagonals, is_arc, is_mile);
      return w;
    }

    local_moran(map_uid, weight_uid, col_name) {
      return Module.local_moran(map_uid, weight_uid, col_name);
    }

    local_moran1(map_uid, weight_uid, values) {
      return Module.local_moran1(map_uid, weight_uid, this.toVecDouble(values));
    }

    local_g(map_uid, weight_uid, col_name) {
      return Module.local_g(map_uid, weight_uid, col_name);
    }

    local_gstar(map_uid, weight_uid, col_name) {
      return Module.local_gstar(map_uid, weight_uid, col_name);
    }

    local_geary(map_uid, weight_uid, col_name) {
      return Module.local_geary(map_uid, weight_uid, col_name);
    }

    local_joincount(map_uid, weight_uid, col_name) {
      return Module.local_joincount(map_uid, weight_uid, col_name);
    }

    parseVecVecInt(vvi) {
      let result = []; 
      for (let i=0; i<vvi.size(); ++i) {
        let sub = [];
        let vi = vvi.get(i);
        for (let j=0; j<vi.size(); ++j) {
          sub.push( vi.get(j) );
        }
        result.push(sub);
      }
      return result;
    }

    parseVecDouble(vd) {
      let result = []
      for (let i=0; i<vd.size(); ++i) {
        result.push( vd.get(i));
      }
      return result;
    }


    toVecString(input) {
      let vs = new Module.VectorString();
      for (let i=0; i<input.length; ++i) {
        vs.push_back(input[i]);
      }
      return vs;
    }

    toVecDouble(input) {
      let vs = new Module.VectorDouble();
      for (let i=0; i<input.length; ++i) {
          if (isNaN(input[i]) || input[i] == Infinity)
            vs.push_back(0);
           else
            vs.push_back(input[i]);
      }
      return vs;
    }

    redcap(map_uid, weight_uid, k, sel_fields, bound_var, min_bound, method) {
      let col_names = this.toVecString(sel_fields);
      let clusters_vec = Module.redcap(map_uid, weight_uid, k, col_names, bound_var, min_bound, method);
      let clusters = this.parseVecVecInt(clusters_vec);
      return clusters;
    }

    maxp(map_uid, weight_uid, k, sel_fields, bound_var, min_bound, method, tabu_length, cool_rate, n_iter) {
      let col_names = this.toVecString(sel_fields);
      let clusters_vec = Module.maxp(map_uid, weight_uid, col_names, bound_var, min_bound, tabu_length, cool_rate, method, k, n_iter);
      let clusters = this.parseVecVecInt(clusters_vec);
      return clusters;
    }

    custom_breaks(map_uid, break_name, k, sel_field, values) {
      var breaks_vec;
      if (sel_field == null) {
        breaks_vec = Module.custom_breaks1(map_uid, k, break_name, this.toVecDouble(values));
      } else {
        breaks_vec = Module.custom_breaks(map_uid, k, sel_field, break_name);
      }
      let breaks = this.parseVecDouble(breaks_vec);
      var orig_breaks = breaks;

      let bins = [];
      let id_array = [];
      for (let i=0; i<breaks.length; ++i) {
        id_array.push([]);
        let txt = isInt(breaks[i]) ? breaks[i] : breaks[i].toFixed(2);
        bins.push("" + txt);
      }
      id_array.push([]);
      let txt = breaks[breaks.length-1];
      txt = isInt(txt) ? txt : txt.toFixed(2);
      bins.push(">" + txt);

      breaks.unshift(Number.NEGATIVE_INFINITY);
      breaks.push(Number.POSITIVE_INFINITY);

      for (let i=0; i<values.length; ++i) {
        let v = values[i];
        for (let j=0; j<breaks.length -1; ++j) {
          let min_val = breaks[j];
          let max_val = breaks[j+1];
          if ( v >= min_val && v < max_val) {
            id_array[j].push(i);
            break;
          }
        }
      }

      for (let i =0; i<bins.length; ++i) {
        //bins[i] += " (" + id_array[i].length + ')';
      }

      return {
        'k' : k,
        'bins' : bins,
        'breaks' : orig_breaks,
        'id_array' : id_array
      }
    }

    cartogram(map_uid, values) {
        let cart = Module.cartogram(map_uid, this.toVecDouble(values));
        let x = cart.get_x();
        let y = cart.get_y();
        let r = cart.get_radius();
        // rescale x, y [-100,0], [0, 45]
        let min_x = x.get(0);
        let max_x = x.get(0);
        let min_y = y.get(0);
        let max_y = y.get(0);
        for (let i=0; i<x.size(); ++i) {
            if (min_x > x.get(i)) min_x = x.get(i);
            if (max_x < x.get(i)) max_x = x.get(i);
            if (min_y > y.get(i)) min_y = y.get(i);
            if (max_y < y.get(i)) max_y = y.get(i);
        }
        let scale_x = 100.0 / (max_x - min_x);
        let scale_y = 45.0 / (max_y - min_y);


        var result = [];
        for (let i=0; i<x.size(); ++i) {
            let xx = (x.get(i) - min_x) * scale_x;
            let yy = (y.get(i) - min_y) * scale_y;
            result.push({
                'properties': {'id' : i},
                'position' : [x.get(i)/10000.0, y.get(i)/10000.0],
                'radius' : r.get(i) 
            });
        }
        return result;
    }
}

// global variables
var usfacts_confirm_data;
var usfacts_death_data;
var usfacts_jsondata;
var onep3a_jsondata;
var state_map = "states_update.geojson";
var county_map = "county_usfacts.geojson";
var map_variable = "confirmed_count";
var choropleth_btn = document.getElementById("btn-nb");
var lisa_btn = document.getElementById("btn-lisa");
var data_btn = document.getElementById("select-data");
var source_btn = document.getElementById("select-source");

var gda_proxy;
var gda_weights = {};

var jsondata = {};
var centroids = {};

var select_map = null;
var select_id = null;
var select_date = null;
var select_variable = null;
var select_method = null;
var show_labels = false;
var select_state_id = -1;

var dates = {};
var confirmed_count_data = {};
var death_count_data = {};
var population_data = {};
var beds_data = {};
var fatality_data = {};
var lisa_data = {};
var lisa_labels = ["Not significant","High-High","Low-Low","High-Low","Low-High","Undefined","Isolated"];
var lisa_colors = ["#ffffff","#FF0000","#0000FF","#a7adf9","#f4ada8","#464646","#999999"];
var cartogram_data;

var current_view = null;

// global functions
var colorScale;
var getFillColor = function(){return [255,255,255,200];};
var getLineColor = function(){return [220,220,220];};


function loadGeoDa(url, loadmap_evt) {
  if (gda_proxy.Has(url)) {
    if (url.endsWith('county_usfacts.geojson')) {
        select_map  = 'county_usfacts.geojson';
        // todo: the following line should be updated to current date
        dates[select_map] = getDatesFromUsaFacts(usfacts_confirm_data);
        if (select_date == null || select_date.indexOf('-')>=0) 
            select_date = dates[select_map][dates[select_map].length-1];

    } else { 
        if (url.endsWith('counties_update.geojson')) {
            select_map  = 'counties_update.geojson';
        } else {
            select_map  = 'states_update.geojson';
        }
        dates[select_map] = getDatesFromGeojson(onep3a_jsondata);
        // todo: the following line should be updated to current date
        if (select_date == null || select_date.indexOf('/')>=0) 
            select_date = dates[select_map][dates[select_map].length-1];
    }
    loadmap_evt();

  } else if (url.endsWith('county_usfacts.geojson')) {
      // load usfacts geojson data
      fetch(url)
        .then((response) => {
            return response.blob();
        })
        .then((bb) => {
            // read as bytearray for GeoDaWASM
            var fileReader = new FileReader();
            fileReader.onload = function(event) {
                var ab = event.target.result;
                gda_proxy.ReadGeojsonMap(url, {result: ab});

                let sel_map = url.indexOf('state') >=0 ? 'state' : 'county';
                select_map  = 'counties_update.geojson'; // only  has county from UsaFacts

                // read as geojson for map
                var jsonReader = new FileReader();
                jsonReader.onload = function(event) {
                    let data = JSON.parse(event.target.result);
                    data = initFeatureSelected(data);
                    usfacts_jsondata = data;
                    // load usfacts csv data
                    let csv_conf_url = "covid_confirmed_usafacts.csv";
                    let csv_death_url = "covid_deaths_usafacts.csv";
                    d3.csv(csv_conf_url, function(confirm_data) {
                        d3.csv(csv_death_url, function(death_data) {
                            select_map  = 'county_usfacts.geojson';
                            usfacts_confirm_data = confirm_data;
                            usfacts_death_data = death_data;
                            // merge usfacts csv data
                            parseUsaFactsData(data, confirm_data, death_data);
                            jsondata[select_map] = data;
                            loadmap_evt();
                        });
                    });
                };
                jsonReader.readAsText(bb); 
                // get centroids for Cartogram
                centroids[select_map] = gda_proxy.GetCentroids(url);
            };
            fileReader.readAsArrayBuffer(bb);
        });
  } else {
    // load 1P3A data 
    fetch(url + ".zip")
        .then((response) => {
            return response.blob();
        })
        .then((blob) => {
            // use a BlobReader to read the zip from a Blob object
            zip.createReader(new zip.BlobReader(blob), function(reader) {
              // get all entries from the zip
              reader.getEntries(function(entries) {
                if (entries.length) {
                    // uncompress first entry content as blob
                    entries[0].getData(new zip.BlobWriter(), function(bb) {
                        // read as bytearray for GeoDaWASM
                        var fileReader = new FileReader();
                        fileReader.onload = function(event) {
                            var ab = event.target.result;
                            gda_proxy.ReadGeojsonMap(url, {result: ab});

                            let sel_map = url.startsWith('state') ? 'state' : 'county';
                            select_map  = sel_map == 'state' ? 'states_update.geojson':'counties_update.geojson';
                            // read as json
                            var jsonReader = new FileReader();
                            jsonReader.onload = function(event) {
                                let data = JSON.parse(event.target.result);
                                data = initFeatureSelected(data);
                                onep3a_jsondata = data;
                                parse1P3AData(data);
                                jsondata[select_map] = data;
                                loadmap_evt();
                            };
                            jsonReader.readAsText(bb); 
                            centroids[select_map] = gda_proxy.GetCentroids(url);
                        };
                        fileReader.readAsArrayBuffer(bb);
                        // close the zip reader
                        reader.close(function() { // onclose callback
                        });
                    }, function(current, total) {// onprogress callback
                    });
                }
              });
            }, function(error) {// onerror callback
                console.log("zip wrong");
            });
        });
  } // end else
}

function getDatesFromUsaFacts(confirm_data)
{
    var xLabels = [];
    let n = confirm_data.length;
    for (let col in confirm_data[0]) {
        if (col.endsWith("2020")) {
            xLabels.push(col);
        }
    }
    return xLabels;
}

function parseUsaFactsData(data, confirm_data, death_data)
{
    let json = getJsonName();
    if (!(json in confirmed_count_data)) confirmed_count_data[json] = {};
    if (!(json in death_count_data)) death_count_data[json] = {};
    if (!(json in fatality_data)) fatality_data[json] = {};
    if (!(json in population_data)) population_data[json] = {};
    if (!(json in beds_data)) beds_data[json] = {};

    dates[select_map] = getDatesFromUsaFacts(confirm_data);
    if (select_date == null || select_date.indexOf('-')>=0) 
        select_date = dates[select_map][dates[select_map].length-1];

    let conf_dict = {};
    let death_dict = {};
    for (let i=0; i<confirm_data.length; ++i) {
        conf_dict[confirm_data[i].countyFIPS] = confirm_data[i];
        death_dict[death_data[i].countyFIPS] = death_data[i];
    }
    for (let i = 0; i < data.features.length; i++) {
        let pop = data.features[i].properties.population;
        let geoid = parseInt(data.features[i].properties.GEOID);
        let beds = data.features[i].properties.beds;
        if (!(geoid in conf_dict)) {
            console.log("UsaFacts does not have:", data.features[i].properties);
            for (let j=0; j<dates[select_map].length; ++j) {
                let d = dates[select_map][j];
                confirmed_count_data[json][d][i] = 0;
                death_count_data[json][d][i] = 0;
                fatality_data[json][d][i] = 0;
            }
            continue;
        }
        population_data[json][i] = pop;
        beds_data[json][i] = beds;

        // confirmed count
        for (let j=0; j<dates[select_map].length; ++j) {
            let d = dates[select_map][j];
            if (!(d in confirmed_count_data[json])) {
                confirmed_count_data[json][d] = {};
            }
            confirmed_count_data[json][d][i] = conf_dict[geoid][d] == '' ? 0 : parseInt(conf_dict[geoid][d]);
        } 
        // death count
        for (var j=0; j<dates[select_map].length; ++j) {
            var d = dates[select_map][j];
            if (!(d in death_count_data[json])) {
                death_count_data[json][d] = {};
            }
            death_count_data[json][d][i] = death_dict[geoid][d]=='' ? 0: parseInt(death_dict[geoid][d]);
        } 
        // fatality
        for (var j=0; j<dates[select_map].length; ++j) {
            var d = dates[select_map][j];
            if (!(d in fatality_data[json])) {
                fatality_data[json][d] = {};
            }
            fatality_data[json][d][i] = 0;
            if (confirmed_count_data[json][d][i] > 0) {
                fatality_data[json][d][i] = death_count_data[json][d][i] / confirmed_count_data[json][d][i];
            }
        }
    }
}

function parse1P3AData(data)
{
    let json = getJsonName();
    if (!(json in confirmed_count_data)) confirmed_count_data[json] = {};
    if (!(json in death_count_data)) death_count_data[json] = {};
    if (!(json in fatality_data)) fatality_data[json] = {};
    if (!(json in population_data)) population_data[json] = {};
    if (!(json in beds_data)) beds_data[json] = {};

    dates[select_map] = getDatesFromGeojson(data);
    if (select_date == null  || select_date.indexOf('/'))
        select_date = dates[select_map][dates[select_map].length-1];

    for (let i = 0; i < data.features.length; i++) {
        let conf = data.features[i].properties.confirmed_count;
        let death = data.features[i].properties.death_count;
        let pop = data.features[i].properties.population;
        let id = data.features[i].properties.id;
        let beds = data.features[i].properties.beds;

        population_data[json][id] = pop;
        beds_data[json][id] = beds;

        // confirmed count
        for (var j=0; j<dates[select_map].length; ++j) {
            var d = dates[select_map][j];
            if (!(d in confirmed_count_data[json])) {
                confirmed_count_data[json][d] = {};
            }
            confirmed_count_data[json][d][id] = data.features[i]["properties"][d];
        } 
        // death count
        for (var j=0; j<dates[select_map].length; ++j) {
            var d = dates[select_map][j];
            if (!(d in death_count_data[json])) {
                death_count_data[json][d] = {};
            }
            death_count_data[json][d][id] = data.features[i]["properties"]['d'+d];
        } 
        // accum
        for (var j=1; j<dates[select_map].length; ++j) {
            var d1 = dates[select_map][j-1];
            var d2 = dates[select_map][j];
            confirmed_count_data[json][d2][id] += confirmed_count_data[json][d1][id];
            death_count_data[json][d2][id] += death_count_data[json][d1][id];
        } 
        // fatality
        for (var j=0; j<dates[select_map].length; ++j) {
            var d = dates[select_map][j];
            if (!(d in fatality_data[json])) {
                fatality_data[json][d] = {};
            }
            fatality_data[json][d][id] = 0;
            if (confirmed_count_data[json][d][id] > 0) {
                fatality_data[json][d][id] = death_count_data[json][d][id] / confirmed_count_data[json][d][id];
            }
        }
    }
}


function OnViewChange(view) {
    current_view = view.viewState;
}

const deckgl = new DeckGL({
    mapboxApiAccessToken: 'pk.eyJ1IjoibGl4dW45MTAiLCJhIjoiY2locXMxcWFqMDAwenQ0bTFhaTZmbnRwaiJ9.VRNeNnyb96Eo-CorkJmIqg',
    mapStyle: 'mapbox://styles/mapbox/dark-v9',
    latitude: 32.850033,
    longitude: -86.6500523,
    zoom: 3.5,
    maxZoom: 18,
    pitch: 0,
    controller: true,
    onViewStateChange: OnViewChange,
    layers: []
});

const mapbox = deckgl.getMapboxMap();
mapbox.addControl(new mapboxgl.NavigationControl(), 'top-left');
mapbox.on('load', () => {
    // add developers name
    var att = document.getElementsByClassName("mapboxgl-ctrl-attrib")[0];
    att.innerHTML = '<a href="https://lixun910.github.io" class="mapbox-improve-map">Dev by #lixun910&nbsp;</a>';
})

mapbox.on('zoomend', () => {
    const currentZoom = mapbox.getZoom();
    let lat = current_view == null? deckgl.viewState.latitude : current_view.latitude;
    let lon = current_view == null? deckgl.viewState.longitude : current_view.longitude;
    deckgl.setProps({
        viewState : {
            zoom: currentZoom,
            latitude: lat,
            longitude: lon
        }
    });
});

function resetView(layers)
{
    deckgl.setProps({
        layers : layers,
        viewState : {
            zoom: 3.5,
            latitude: 32.850033,
            longitude: -86.6500523,
            transitionInterpolator: new LinearInterpolator(['bearing']),
            transitionDuration: 500
        }
    });
}

function setCartogramView(layers)
{
    if (isState()) {
        deckgl.setProps({
            layers : layers,
            viewState : {
                zoom: 6.6,
                latitude: 3.726726,
                longitude: -8.854194,
                transitionInterpolator: new LinearInterpolator(['bearing']),
                transitionDuration: 500
            }
        });
    } else {
        deckgl.setProps({
            layers : layers,
            viewState : {
                zoom: 5.6,
                latitude: 13.510908,
                longitude: -28.190367,
                transitionInterpolator: new LinearInterpolator(['bearing']),
                transitionDuration: 500
            }
        }); 
    }
}

function createMap(data) {
    
    if (select_date == null)  
        select_date = dates[select_map][dates[select_map].length-1];

    var labels = [];
    var cents = centroids[select_map];
    console.log("centroids from :", select_map);

    if (isLisa()) {
        for (let i=0; i < data.features.length; ++i) {
            let json = getJsonName();
            if (json == "county") {
                let field = data_btn.innerText;
                let c = lisa_data[json][select_date][field].clusters[i];
                if ( c== 1) 
                    labels.push({id: i, position: cents[i], text: data.features[i].properties.NAME});
            }
        }
    } 

    var layers = [];

    if (isCartogram()) {
        mapbox.getCanvas().hidden = true;
        if ('name' in data && data.name.startsWith("state"))  {
            for (let i=0; i < data.features.length; ++i) {
                labels.push({id: i, position: cartogram_data[i].position, text: data.features[i].properties.NAME});
            } 
        }
        layers.push(
            new ScatterplotLayer({
                data: cartogram_data,
                getPosition: d => d.position,
                getFillColor: getFillColor,
                getLineColor: getLineColor,
                getRadius: d => d.radius * 10,
                onHover: updateTooltip,
                onClick: updateTrendLine,
                pickable: true,
                updateTriggers: {
                    getLineColor: [
                        select_id 
                    ],
                    getFillColor: [
                        select_date,select_variable, select_method
                    ]
                },
            })
        );
        layers.push(
            new TextLayer({
                data: labels,
                pickable: true,
                getPosition: d => d.position,
                getText: d => d.text,
                getSize: 12,
                fontFamily: 'Gill Sans Extrabold, sans-serif',
                getTextAnchor: 'middle',
                getAlignmentBaseline: 'bottom',
                getColor: [20, 20, 20]
            })
        );
        setCartogramView(layers);

    } else {
        mapbox.getCanvas().hidden = false;
        layers.push(
            new GeoJsonLayer({
                id : 'map-layer',
                data: data,
                opacity: 0.5,
                stroked: true,
                filled: true,
                //wireframe: true,
                //fp64: true,
                lineWidthScale: 1,
                lineWidthMinPixels: 1,
                getElevation: getElevation,
                getFillColor: getFillColor,
                getLineColor: getLineColor,

                updateTriggers: {
                    getLineColor: [
                    ],
                    getFillColor: [
                        select_date,select_variable, select_method
                    ]
                },
                pickable: true,
                onHover: updateTooltip,
                onClick: updateTrendLine
            })
        );
        if (!('name' in data)) {
            layers.push(
                new GeoJsonLayer({
                    data: './states.geojson',
                    opacity: 0.5,
                    stroked: true,
                    filled: false,
                    lineWidthScale: 1,
                    lineWidthMinPixels: 1.5,
                    getLineColor: [220,220,220],
                    pickable: false
                })
            );
        } 

        if (show_labels) {
            layers.push(
                new TextLayer({
                    data: labels,
                    pickable: true,
                    getPosition: d => d.position,
                    getText: d => d.text,
                    getSize: 18,
                    fontFamily: 'Gill Sans Extrabold, sans-serif',
                    getTextAnchor: 'middle',
                    getAlignmentBaseline: 'bottom',
                    getColor: [250, 250, 250],
                    fontSettings: {
                        buffer: 20,
                        sdf: true,
                        radius: 6
                    }
                })
            );
        }
        resetView(layers);
    }

    if (document.getElementById('linechart').innerHTML == "" || 
        d3.select("#slider").node().max != dates[select_map].length) 
    {
        addTrendLine(data, "");
    } else {
        updateTrendLine({x:0,y:0,object:null});
    }
    
    createTimeSlider(data);
}



function loadMap(url) {
    createMap(jsondata[select_map]);
}

function isCartogram()
{
    return document.getElementById('cartogram-ckb').checked;
}

function getElevation(f) 
{
    return f.properties.id == select_id ? 90000 : 1;
}

function buttonClicked(evt) {
    console.log(evt);
}

function initFeatureSelected(features) {
    for (let i = 0; i < features.features.length; i++) {
        // Track each feature individually with a unique ID.
        features.features[i].properties.id = i;
    }
    return features;
}

function GetFeatureValue(id)
{
    let json = getJsonName();
    let txt = data_btn.innerText;
    if (txt == "Confirmed Count") {
        return confirmed_count_data[json][select_date][id];
    } else if (txt == "Confirmed Count per 10K Population") {
        if (population_data[json][id] == undefined || population_data[json][id] == 0) return 0;
        return (confirmed_count_data[json][select_date][id] / population_data[json][id] * 10000).toFixed(3);
    } else if (txt == "Confirmed Count per Licensed Bed") {
        if (beds_data[json][id] == undefined || beds_data[json][id] == 0) return 0;
        return ( confirmed_count_data[json][select_date][id] / beds_data[json][id]).toFixed(3);
    } else if (txt == "Death Count") {
        return death_count_data[json][select_date][id];
    } else if (txt == "Death Count per 10K Population") {
        if (population_data[json][id] == undefined || population_data[json][id] == 0) return 0;
        return (death_count_data[json][select_date][id] / population_data[json][id] * 10000).toFixed(3);
    } else if (txt == "Death Count/Confirmed Count") {
        return fatality_data[json][select_date][id];
    } else if (txt == "Daily New Confirmed Count") {
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx == 0) return 0;
        let prev_date = dates[select_map][dt_idx-1];
        var cur_vals = confirmed_count_data[json][select_date];
        var pre_vals = confirmed_count_data[json][prev_date];
        return cur_vals[id] - pre_vals[id];

    } else if (txt == "Daily New Confirmed Count per 10K Pop") {
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx == 0) return 0;
        let prev_date = dates[select_map][dt_idx-1];
        var cur_vals = confirmed_count_data[json][select_date];
        var pre_vals = confirmed_count_data[json][prev_date];
        return ((cur_vals[id] - pre_vals[id]) / population_data[json][id] * 10000).toFixed(3);

    } else if (txt == "Daily New Death Count") {
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx == 0) return 0;
        let prev_date = dates[select_map][dt_idx-1];
        var cur_vals = death_count_data[json][select_date];
        var pre_vals = death_count_data[json][prev_date];
        return cur_vals[id] - pre_vals[id];

    } else if (txt == "Daily New Death Count per 10K Pop") {
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx == 0) return 0;
        let prev_date = dates[select_map][dt_idx-1];
        var cur_vals = death_count_data[json][select_date];
        var pre_vals = death_count_data[json][prev_date];
        return ((cur_vals[id] - pre_vals[id]) / population_data[json][id] * 10000).toFixed(3);
    } 
    return 0;
}

function GetDataValues()
{
    let json = getJsonName();
    let txt = data_btn.innerText;
    if (txt == "Confirmed Count") {
        return Object.values(confirmed_count_data[json][select_date]);
    } else if (txt == "Confirmed Count per 10K Population") {
        var vals = [];
        for (var id in confirmed_count_data[json][select_date]) {
            if (population_data[json][id] == undefined || population_data[json][id] == 0) 
                vals.push(0);
            else
                vals.push(confirmed_count_data[json][select_date][id] / population_data[json][id] * 10000);
        }
        return vals;

    } else if (txt == "Confirmed Count per Licensed Bed") {
        var vals = [];
        for (var id in confirmed_count_data[json][select_date]) {
            if (beds_data[json][id] == undefined || beds_data[json][id] == 0) 
                vals.push(0);
            else
                vals.push(confirmed_count_data[json][select_date][id] / beds_data[json][id]);
        }
        return vals;

    } else if (txt == "Death Count") {
        return Object.values(death_count_data[json][select_date]);
    } else if (txt == "Death Count per 10K Population") {
        var vals = [];
        for (var id in death_count_data[json][select_date]) {
            if (population_data[json][id] == undefined || population_data[json][id] == 0) 
                vals.push(0);
            else
                vals.push(death_count_data[json][select_date][id] / population_data[json][id] * 10000);
        }
        return vals;
    } else if (txt == "Death Count/Confirmed Count") {
        return Object.values(fatality_data[json][select_date]);
    } else if (txt == "Daily New Confirmed Count") {
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx == 0) return;
        let prev_date = dates[select_map][dt_idx-1];
        var cur_vals = confirmed_count_data[json][select_date];
        var pre_vals = confirmed_count_data[json][prev_date];
        var rt_vals = [];
        for (let i in cur_vals) {
            rt_vals.push(cur_vals[i] - pre_vals[i]);
        }
        return rt_vals;

    } else if (txt == "Daily New Confirmed Count per 10K Pop") {
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx == 0) return 0;
        let prev_date = dates[select_map][dt_idx-1];
        var cur_vals = confirmed_count_data[json][select_date];
        var pre_vals = confirmed_count_data[json][prev_date];
        var rt_vals = [];
        for (let i in cur_vals) {
            rt_vals.push((cur_vals[i] - pre_vals[i]) / population_data[json][i] * 10000);
        }
        return rt_vals;

    } else if (txt == "Daily New Death Count") {
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx == 0) return 0;
        let prev_date = dates[select_map][dt_idx-1];
        var cur_vals = death_count_data[json][select_date];
        var pre_vals = death_count_data[json][prev_date];
        var rt_vals = [];
        for (let i in cur_vals) {
            rt_vals.push(cur_vals[i] - pre_vals[i]);
        }
        return rt_vals;

    } else if (txt == "Daily New Death Count per 10K Pop") {
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx == 0) return 0;
        let prev_date = dates[select_map][dt_idx-1];
        var cur_vals = death_count_data[json][select_date];
        var pre_vals = death_count_data[json][prev_date];
        var rt_vals = [];
        for (let i in cur_vals) {
            rt_vals.push((cur_vals[i] - pre_vals[i]) / population_data[json][i] * 10000);
        }
        return rt_vals;
    } 
}


function OnCountyClick(evt) {
    function init_county(evt) {
        var vals;
        var nb;
        select_method = "choropleth";
            vals = GetDataValues();
            console.log(vals);
            nb = gda_proxy.custom_breaks(county_map, "natural_breaks", 8, null, vals); 
        colorScale = function(x) {
            if (x==0)  return COLOR_SCALE[0];
            for (var i=1; i<nb.breaks.length; ++i) {
                if (x < nb.breaks[i]) 
                    return COLOR_SCALE[i];
            }
        };
        getFillColor = function(f) {
            let v = GetFeatureValue(f.properties.id);
            if (v == 0) return [255, 255, 255, 200];
            return colorScale(v);
        };
        getLineColor = function(f) 
        {
            return f.properties.id == select_id ? [255,0,0] : [200,200,200];
        };
        UpdateLegend();
        UpdateLegendLabels(nb.bins);
        choropleth_btn.classList.add("checked");
        lisa_btn.classList.remove("checked");

        if (isCartogram()) {
            cartogram_data = gda_proxy.cartogram(county_map, vals);
        }
        loadMap(county_map);
    }
    if (evt != undefined) {
        if (evt.innerText.indexOf('UsaFacts')>=0) {
            county_map = "county_usfacts.geojson";
        } else {
            county_map = "counties_update.geojson";
        }
    }
    loadGeoDa(county_map, init_county);
}

function OnStateClick(evt) {
    function init_state() {
        var vals;
        var nb;
        select_method = "choropleth";
            vals = GetDataValues();
            nb = gda_proxy.custom_breaks(state_map, "natural_breaks", 8, null, vals); 
        colorScale = function(x) {
            if (x==0)  return COLOR_SCALE[0];
            for (var i=1; i<nb.breaks.length; ++i) {
                if (x < nb.breaks[i]) 
                    return COLOR_SCALE[i];
            }
        };
        getFillColor = function(f) {
            let v = GetFeatureValue(f.properties.id);
            if (v == 0) return [255, 255, 255];
            return colorScale(v);
        };
        getLineColor = function(f) 
        {
            return f.properties.id == select_id ? [255,0,0] : [255, 255, 255, 50];
        };
        UpdateLegend();
        UpdateLegendLabels(nb.bins);
        choropleth_btn.classList.add("checked");
        lisa_btn.classList.remove("checked");

        if (isCartogram()) {
            cartogram_data = gda_proxy.cartogram(state_map, vals);
        }

        loadMap(state_map);
    }
    loadGeoDa(state_map, init_state);
}

function UpdateLegend()
{
    const div = document.getElementById('legend');
    div.innerHTML = `<div class="legend" style="background: rgb(240, 240, 240); width: 7.69231%;"></div>
    <div class="legend" style="background: rgb(255, 237, 160); width: 7.69231%;"></div>
    <div class="legend" style="background: rgb(254, 217, 118); width: 7.69231%;"></div>
    <div class="legend" style="background: rgb(254, 178, 76); width: 7.69231%;"></div>
    <div class="legend" style="background: rgb(253, 141, 60); width: 7.69231%;"></div>
    <div class="legend" style="background: rgb(252, 78, 42); width: 7.69231%;"></div>
    <div class="legend" style="background: rgb(227, 26, 28); width: 7.69231%;"></div>
    <div class="legend" style="background: rgb(189, 0, 38); width: 7.69231%;"></div>
    <div class="legend" style="background: rgb(128, 0, 38); width: 7.69231%;"></div>
`;
}

function UpdateLegendLabels(breaks) {
    let field = data_btn.innerText;
    const div = document.getElementById('legend-labels');
    var cont = '<div style="width: 7.69231%;text-align:center">0</div>';
    for (var i=0; i<breaks.length; ++i) {
        let val =  breaks[i];
        if (field == "Death Count/Confirmed Count") {
            cont += '<div style="width: 7.69231%;text-align:center">' + val + '</div>';
        } else {
            if (val[0] == '>') {
                val = val.substring(1, val.length);
                if (val.indexOf('.') >= 0) {
                    // format float number
                    val = parseFloat(val);
                    val = val.toFixed(2);
                } else {
                    val = parseInt(val);
                    if (val > 10000) val = d3.format(".2s")(val);
                }
                cont += '<div style="width: 7.69231%;text-align:center">>' + val + '</div>';
            } else {
                if (val.indexOf('.') >= 0) {
                    // format float number
                    val = parseFloat(val);
                    val = val.toFixed(2);
                } else {
                    val = parseInt(val);
                    if (val > 10000) val = d3.format(".2s")(val);
                }
                cont += '<div style="width: 7.69231%;text-align:center">' + val + '</div>';
            }
        }
    }
    div.innerHTML = cont;
}

function UpdateLisaLegend(colors) {
    const div = document.getElementById('legend');
    var cont = '<div class="legend" style="background: #eee; width: 20%;"></div>';
    for (var i=1; i<colors.length; ++i) {
        cont += '<div class="legend" style="background: '+colors[i]+'; width: 20%;"></div>';
    }
    div.innerHTML = cont;
}

function UpdateLisaLabels(labels) {
    const div = document.getElementById('legend-labels');
    var cont = '<div style="width: 20%;text-align:center">Not Sig</div>';
    for (var i=1; i<5; ++i) {
        cont += '<div style="width: 20%;text-align:center">' +labels[i]+ '</div>';
    }
    div.innerHTML = cont;
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return  [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
  }


function isState()
{
    return source_btn.innerText.indexOf('State') >= 0;
}

function isLisa()
{
    return document.getElementById("btn-lisa").classList.contains("checked");
}

function getCurrentWuuid()
{
    if (!(select_map in gda_weights)) {
            var w = gda_proxy.CreateQueenWeights(select_map, 1, 0, 0);
            gda_weights[select_map] = w;
    } 
    return {'map_uuid':select_map, 'w_uuid':gda_weights[select_map].get_uid()};
}

function getJsonName()
{
    return select_map;
}

function OnChoroplethClick(evt) {
    select_method = "choropleth";
    if (isState()) {
        OnStateClick();
    } else {
        OnCountyClick();
    }
}

function OnLISAClick(evt) {
    select_method = "lisa";

    var w = getCurrentWuuid();
    var data = GetDataValues();
    let field = data_btn.innerText;
    let json = getJsonName();
    var color_vec = lisa_colors;
    var labels = lisa_labels;
    var clusters;
    var sig;

    if (!(json in lisa_data)) lisa_data[json] = {};

    if (select_date in lisa_data[json] && field in lisa_data[json][select_date]) {
        clusters = lisa_data[json][select_date][field].clusters;
        sig = lisa_data[json][select_date][field].sig;

    } else {
        var lisa = gda_proxy.local_moran1(w.map_uuid, w.w_uuid, data);
        clusters = gda_proxy.parseVecDouble(lisa.clusters());
        sig = gda_proxy.parseVecDouble(lisa.significances());
        if (!(select_date in lisa_data[json])) lisa_data[json][select_date] = {}
        if (!(field in lisa_data[json][select_date])) lisa_data[json][select_date][field] = {}
        lisa_data[json][select_date][field]['clusters'] = clusters;
        lisa_data[json][select_date][field]['pvalues'] = sig;
    }
    
    color_vec[0] = '#ffffff';

    getFillColor = function(f) {
        var c = clusters[f.properties.id];
        if (c == 0) return [255, 255, 255, 200];
        return hexToRgb(color_vec[c]);
    };

    getLineColor = function(f) 
    {
        if (f.properties.STATEFP!=select_state_id) return [255,255,255,0];
        return f.properties.id == select_id ? [255,0,0] : [255, 255, 255, 50];
    };

    UpdateLisaLegend(color_vec);
    UpdateLisaLabels(labels);

    evt.classList.add("checked");
    document.getElementById("btn-nb").classList.remove("checked");

    if (isState()) {
        loadMap(state_map);
    } else {
        loadMap(county_map);
    }
}

function loadScript(url) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    const head = document.querySelector('head');
    head.appendChild(script);
    return new Promise(resolve => {
      script.onload = resolve;
    });
  }

// MAIN ENTRY
var Module = { onRuntimeInitialized: function() {
    gda_proxy = new GeodaProxy();
    OnCountyClick();
}};

function OnSourceClick(evt)
{
    source_btn.innerText = evt.innerText; 

    if (isLisa()) {
        OnLISAClick(document.getElementById('btn-lisa'));
    } else {
        select_method = "choropleth";
        if (isState()) {
            OnStateClick();
        } else {
            OnCountyClick(evt);
        }
    }
}

function OnDataClick(evt)
{
    data_btn.innerText = evt.innerText; 
    select_variable = evt.innerText;

    if (isLisa()) {
        OnLISAClick(document.getElementById('btn-lisa'));
    } else {
        select_method = "choropleth";
        if (isState()) {
            OnStateClick();
        } else {
            OnCountyClick();
        }
    }
}

function OnCartogramClick(el)
{
        select_method = "choropleth";
        if (isState()) {
            OnStateClick();
        } else {
            OnCountyClick();
        }
}

function updateTooltip({x, y, object}) {
    const tooltip = document.getElementById('tooltip');

    if (object) {
        let id = object.properties.id;
        let json = getJsonName();
        let txt = data_btn.innerText;

        //if (txt == "Confirmed Count") {
        let v1 = confirmed_count_data[json][select_date][id];
        //} else if (txt == "Confirmed Count per 10K Population") {
        let v2 = (population_data[json][id] == undefined || population_data[json][id] == 0) ? 0 : (confirmed_count_data[json][select_date][id] / population_data[json][id] * 10000);
        //} else if (txt == "Death Count") {
        let v3 = death_count_data[json][select_date][id];
        //} else if (txt == "Death Count per 10K Population") {
        let v4 = (population_data[json][id] == undefined || population_data[json][id] == 0) ? 0 : (death_count_data[json][select_date][id] / population_data[json][id] * 10000);
        //} else if (txt == "Fatality Rate") {
        let v5 = fatality_data[json][select_date][id];
        let v6 = population_data[json][id];

        let v7 = 0;
        let dt_idx = dates[select_map].indexOf(select_date);
        if (dt_idx > 0) {
            let prev_date = dates[select_map][dt_idx-1];
            var cur_vals = confirmed_count_data[json][select_date];
            var pre_vals = confirmed_count_data[json][prev_date];
            v7 = cur_vals[id] - pre_vals[id];
        }
        let v8 = (population_data[json][id] == undefined || population_data[json][id] == 0) ? 0 : (v7 / population_data[json][id] * 10000);

        let v9 = 0;
        if (dt_idx > 0) {
            let prev_date = dates[select_map][dt_idx-1];
            var cur_vals = death_count_data[json][select_date];
            var pre_vals = death_count_data[json][prev_date];
            v9 = cur_vals[id] - pre_vals[id];
        }
        let v10 = (population_data[json][id] == undefined || population_data[json][id] == 0) ? 0 : (v9 / population_data[json][id] * 10000);
        let v11 = (beds_data[json][id] == undefined || beds_data[json][id] == 0) ? 0 : (confirmed_count_data[json][select_date][id] / beds_data[json][id]);
        let v12 = beds_data[json][id];

        let name = "";
        if ('NAME' in object.properties) 
            name =  object.properties.NAME;
        else 
            name = jsondata[json].features[id].properties.NAME;

        if (!isInt(v2)) v2 = parseFloat(v2).toFixed(2);
        if (!isInt(v4)) v4 = parseFloat(v4).toFixed(2);

        let text = '<div><b>' + name +':</b><br/><br/></div>';
        text += '<table>'
        text += '<tr><td><b>Confirmed Count:</b></td><td>' + v1 + '</td>';
        text += '<tr><td><b>Confirmed Count per 10K Population:</b></td><td>' + v2 + '</td>';
        text += '<tr><td><b># Licensed Hosptial Beds:</b></td><td>' + v12 + '</td>';
        text += '<tr><td><b>Confirmed Count per Licensed Bed:</b></td><td>' + v11.toFixed(2) + '</td>';
        text += '<tr><td><b>Death Count:</b></td><td>' + v3 + '</td>';
        text += '<tr><td><b>Death Count per 10K Population:</b></td><td>' + v4 + '</td>';
        text += '<tr><td><b>Death Count/Confirmed Count:</b></td><td>' + v5.toFixed(2) + '</td>';
        text += '<tr><td><b>Population:</b></td><td>' + v6 + '</td>';
        text += '<tr><td><b>Daily New Confirmed Count:</b></td><td>' + v7 + '</td>';
        text += '<tr><td><b>Daily New Confirmed Count per 10K Pop:</b></td><td>' + v8.toFixed(2) + '</td>';
        text += '<tr><td><b>Daily New Death Count:</b></td><td>' + v9 + '</td>';
        text += '<tr><td><b>Daily New Confirmed Count per 10K Pop:</b></td><td>' + v10.toFixed(2) + '</td>';
        text += '</table>';

        if (isLisa()) {
            let json = getJsonName();
            let field = data_btn.innerText;
            let c = lisa_data[json][select_date][field].clusters[id];
            text += '<br/><div><b>' + lisa_labels[c] +'</b></div>';
            text += '<div><b>p-value:</b>' + lisa_data[json][select_date][field].pvalues[id] +'</div>';
            text += '<div>Queen weights and 999 permutations</div>';
        }

        tooltip.style.top = `${y}px`;
        tooltip.style.left = `${x}px`;
        tooltip.innerHTML = text;
    } else {
        tooltip.innerHTML = '';
    }
}

function getDatesFromGeojson(data) {
    var xLabels = [];
    for (var col in data["features"][0]["properties"]) {
        if (col.startsWith("2020") ) {
            xLabels.push(col);
        }
    }
    return xLabels;
}

function getConfirmedCountByDateState(data, state) {
    var features = data['features'];
    var dates = getDatesFromGeojson(data);
    var counts = 0;
    for (var j =0; j<features.length; ++j) {
        if (features[j]["properties"]["STUSPS"] == state) {
            for (var i=0; i<dates.length; ++i) {
                var d = dates[i];
                if (d <= select_date) {
                    counts += features[j]["properties"][d];
                }
            }   
            break;
        }
    }
    return counts;
}

function getConfirmedCountByDateCounty(county_id, all) {    
    let json = getJsonName();
    let n_count = Object.keys(confirmed_count_data[json][select_date]).length;
    var counts = [];
    let d0 = dates[select_map][0];
    let sum = 0;
    if (all || d0 <= select_date) {
        sum = confirmed_count_data[json][d0][county_id];
    }
   counts.push(sum);
    for (let i=1; i<dates[select_map].length; ++i) {
        let sum = 0;
        let d0 = dates[select_map][i-1];
        let d1 = dates[select_map][i];
        if (all || d1 <= select_date) {
            sum = (confirmed_count_data[json][d1][county_id] - confirmed_count_data[json][d0][county_id]);
        }
        counts.push(sum);
    }
    return counts;
}

function getConfirmedCountByDate(data, all) {    
    let json = getJsonName();
    let n_count = Object.keys(confirmed_count_data[json][select_date]).length;
    var counts = [];
    let d0 = dates[select_map][0];
    // get total count for 1st day
    let sum = 0;
    for (let j =0; j<n_count; ++j) {
        if (all || d0 <= select_date) {
           sum = confirmed_count_data[json][d0][j];
       }
   }   
   counts.push(sum);

    for (let i=1; i<dates[select_map].length; ++i) {
        let pre_sum = 0;
        let cur_sum = 0;
        let d0 = dates[select_map][i-1];
        let d1 = dates[select_map][i];
        if (all || d1 <= select_date) {
            for (let j =0; j<n_count; ++j) {
                pre_sum += confirmed_count_data[json][d0][j];
                cur_sum += confirmed_count_data[json][d1][j];
            }
        }   
        counts.push(cur_sum - pre_sum < 0? 0:cur_sum - pre_sum);
    } 
    return counts;
}

function getAccumConfirmedCountByDate(data, all) {    
    var counts = getConfirmedCountByDate(data, all);
    for (var i=1; i<counts.length; ++i) {
        counts[i] = counts[i-1] + counts[i];
    }
    return counts;
}


// following code are for LINE CHART
function addTrendLine(data, title) {
    
    var height = 140;
    var width = 290;
    var margin = {top: 10, right:20, bottom: 50, left: 50};

    d3.select("#linechart svg").remove();

    var svg = d3.select("#linechart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("transform", "translate(0," + margin.top + ")");

    svg.append("g").attr("class", "y axis");
    svg.append("g").attr("class", "x axis");
        
    var xScale = d3.scaleBand().range([margin.left, width], .1);
    var yScale = d3.scaleLinear().range([height, 10]);
    var xAxis = d3.axisBottom().scale(xScale);
    var yAxis = d3.axisLeft().scale(yScale);

    // extract the x labels for the axis and scale domain
    var xLabels = dates[select_map]; 
    xScale.domain(xLabels);
    
    var yValues = getConfirmedCountByDate(data, false);
    yScale.domain([0, Math.max.apply(null, yValues)]);

    var tmpData = [];
    for (var i=0; i<xLabels.length; ++i) {
        tmpData.push({"date":xLabels[i], "confirmedcases":yValues[i]});
    }
    var line = d3.line()
        .x(function(d) { return xScale(d['date']); })
        .y(function(d) { return yScale(d['confirmedcases']); });

    svg.append("path")
        .datum(tmpData)
        .attr("class","line")
        .attr("d", line);    

    svg.append("g")
        .attr("transform", "translate(0," + (height) + ")")
        .call(xAxis.tickValues(xLabels.filter(function(d, i) { 
            if (i % 4 == 0)
                return d;
            })).tickFormat(function(e){
                let d = new Date(e);
                let mo = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(d)
                let da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d)
                return da + '-' + mo;
            }))
        .selectAll("text")
        .style("text-anchor","end")
        .attr("class", "xaxis")
        .attr("transform", function(d) {
            return "rotate(-45)";
        });

    svg.append("g")
        .attr("transform", "translate(" + (margin.left) + ",0)")
        .attr("class", "yaxis")
        .call(yAxis.tickFormat(function(e,i) {
            if(i %2 == 1 || Math.floor(e) != e) 
                return; 
            return d3.format(",")(e);
        }));


    // chart title
    svg.append("text")
        .attr("class","linetitle")
        .attr("x", (width + (margin.left + margin.right) )/ 2)
        .attr("y", 0 + margin.top)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-family", "sans-serif")
        .text(title);
}

// ** Update data section (Called from the onclick)
function updateTrendLine({x,y,object}) 
{
    var height = 140;
    var width = 290;
    var margin = {top: 10, right:20, bottom: 50, left: 50};
    var xLabels, yValues, title;
    let  json = getJsonName();

    xLabels = dates[select_map];
    if (object) {
        yValues = getConfirmedCountByDateCounty(object.properties.id, false);
    } else {
        yValues = getConfirmedCountByDate(jsondata[json], false);
    }
    title = object ? object.properties["NAME"] : "all";

    // Get the data again
    var tmpData = [];
    for (var i=0; i<xLabels.length; ++i) {
        tmpData.push({"date":xLabels[i], "confirmedcases":yValues[i]});
    }

    var xScale = d3.scaleBand()
        .range([margin.left, width], .1);
        
    var yScale = d3.scaleLinear()
        .range([height, 10]);

    // Scale the range of the data again 
    xScale.domain(xLabels);
    yScale.domain([0, Math.max.apply(null, yValues)]);

    // Select the section we want to apply our changes to
    var svg = d3.select("#linechart svg").transition();

    var line = d3.line()
        .x(function(d) { return xScale(d['date']); })
        .y(function(d) { return yScale(d['confirmedcases']); });

    var xAxis = d3.axisBottom()
        .scale(xScale);
        
    var yAxis = d3.axisLeft()
        .scale(yScale);

    // Make the changes
    svg.select(".line")   // change the line
        .duration(750)
        .attr("d", line(tmpData));
    svg.select(".yaxis") // change the y axis
        .duration(750)
        .call(yAxis);
    svg.select(".xaxis") // change the y axis
        .duration(750)
        .call(xAxis);
    
    svg.select(".linetitle")
        .text(title);
}

function createTimeSlider(geojson)
{
    if(document.getElementById("slider-svg").innerHTML.length > 0) {
        if (d3.select("#slider").node().max != dates[select_map].length) {
            d3.select("#slider-svg").select("svg").remove();
        } else {
            return;
        }
    }

    var width = 320,
        height = 180,
        padding = 28;

    var svg = d3.select("#slider-svg")
        .append("svg")
        .attr("width", width + padding*2)
        .attr("height", height);

    var xScale = d3.scaleBand()
        .range([padding, width], .1);
        
    var yScale = d3.scaleLinear()
        .range([height -padding, padding]);

    var xLabels = dates[select_map];
    xScale.domain(xLabels);
   
    d3.select("#slider").node().max = xLabels.length;
    d3.select("#slider").node().value = xLabels.length;
    
    var yValues = getAccumConfirmedCountByDate(geojson, true);
    yScale.domain([0, Math.max.apply(null, yValues)]);

    var tmpData = [];
    for (var i=0; i<xLabels.length; ++i) {
        tmpData.push({"date":xLabels[i], "confirmedcases":yValues[i]});
    }


    var bars = svg.selectAll(".bars")
        .data(tmpData)
        .enter()
        .append("rect")
        .attr("x", d => xScale(d.date))
        .attr("width", xScale.bandwidth() - 1)
        .attr("y", d => yScale(d.confirmedcases))
        .attr("height", d => height - padding - yScale(d.confirmedcases))
        .text("1")
        .attr("fill", (d => xLabels[d3.select("#slider").node().value-1] == d.date ? "red" : "gray"));
    var xAxis = d3.axisBottom(xScale);
    var yAxis = d3.axisRight(yScale);

    //var gX = svg.append("g")
    //    .attr("transform", "translate(0," + (height - padding) + ")")
    //    .call(xAxis);

    var gY = svg.append("g")
        .attr("class", "axis--y")
        .attr("transform", "translate(" + (width) + ",0)")
        .call(yAxis.tickFormat(function(e,i){
            if(i %2 == 1) 
                return; 
            return d3.format(",")(e);
        }));

    svg.append("text")
        .attr("transform", "translate(" + (width/2) + "," + 0 + ")")
        .attr("dy", "1em")
        .attr("class", "slider_text")
        .attr("text-anchor", "end")
        .style("fill", "gray")
        .html(select_date);

    d3.select("#slider").on("input", function() {
        var currentValue = parseInt(this.value);
        select_date = dates[select_map][currentValue-1];
        console.log(select_date);

        document.getElementById('time-container').innerText = select_date;
        var xLabels = dates[select_map];
        xScale.domain(xLabels);

        var yValues = getAccumConfirmedCountByDate(geojson, true);
        yScale.domain([0, Math.max.apply(null, yValues)]);

        bars.attr("y", d => yScale(d.confirmedcases))
            .attr("height", d => height - padding - yScale(d.confirmedcases))
            .attr("fill", (d => xLabels[currentValue-1] == d.date ? "red" : "gray"));

        d3.select(".slider_text")
            .html(select_date);

        //gY.call(yAxis);
        if (isLisa()) {
            OnLISAClick(document.getElementById('btn-lisa'));
        } else {
            if (isState()) {
                OnStateClick();
            } else {
                OnCountyClick();
            }
        }
    })
}

function saveText(text, filename){
    var a = document.createElement('a');
    a.setAttribute("id", filename);
    a.setAttribute('href', 'data:text/plain;charset=utf-8,'+encodeURIComponent(text));
    a.setAttribute('download', filename);
    a.click()
  }

function OnSave() {
    d3.json("lisa_dates.json", function(ds) {
        // only new lisa results will be saved
        let save_dates = [];
        for (let i=ds.length; i<dates[select_map].length; ++i) {
            let d = dates[select_map][i];
            if (d in lisa_data[select_map]) {
                console.log('lisa'+d+'.json');
                save_dates.push(d);
                setTimeout(function(){saveText( JSON.stringify(lisa_data[select_map][d]), "lisa"+d+".json" );}, 100*(i-ds.length));
            }
        }
        // update dates
        saveText( JSON.stringify(save_dates), "lisa_dates.json");
    });
}

d3.json("lisa_dates.json", function(ds) {
    // load lisa from cache
    if (!('county_usfacts.geojson' in lisa_data))
        lisa_data['county_usfacts.geojson'] = {};
    for (let i=0; i<ds.length; ++i) {
        let d = ds[i];
        let d_fn = d.replace(/\//g, '_');
        d3.json("lisa/lisa"+d_fn+'.json', function(data){
            if (data != null) {
                lisa_data['county_usfacts.geojson'][d] = data;
            }
        });
    }
})

function OnShowLabels(el)
{
    show_labels = el.checked;
    if (isLisa()) {
        OnLISAClick(document.getElementById('btn-lisa'));
    } else {
        if (isState()) {
            OnStateClick();
        } else {
            OnCountyClick();
        }
    }
}

function OnShowTime(el) 
{
    let disp = el.checked ? 'block' : 'none';
    document.getElementById('time-container').parentElement.style.display = disp;
}

function collapse(el)
{
    if (document.getElementById("toolbox").classList.contains("collapse")) {
        document.getElementById('toolbox').classList.remove("collapse");
        el.src="img/collapse.png";
    } else {
        document.getElementById('toolbox').classList.add("collapse");
        el.src="img/expand.png";
    }
}