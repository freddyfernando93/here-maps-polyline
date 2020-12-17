import { StatusBar } from 'expo-status-bar';
import React, {useState, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, StyleSheet, Text, View, Dimensions, ActivityIndicator } from 'react-native';
import MapView, {Polyline, Marker} from 'react-native-maps'
import axios from 'axios'
import Reactotron from 'reactotron-react-native'

const DEFAULT_PRECISION = 5;

const ENCODING_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const DECODING_TABLE = [
  62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
];

const FORMAT_VERSION = 1;

const ABSENT = 0;
const LEVEL = 1;
const ALTITUDE = 2;
const ELEVATION = 3;
// Reserved values 4 and 5 should not be selectable
const CUSTOM1 = 6;
const CUSTOM2 = 7;
const Num = typeof BigInt !== "undefined" ? BigInt : Number;

function decode(encoded) {
  const decoder = decodeUnsignedValues(encoded);
  const header = decodeHeader(decoder[0], decoder[1]);

  const factorDegree = 10 ** header.precision;
  const factorZ = 10 ** header.thirdDimPrecision;
  const { thirdDim } = header;

  let lastLat = 0;
  let lastLng = 0;
  let lastZ = 0;
  const res = [];

  let i = 2;
  for (;i < decoder.length;) {
    const deltaLat = toSigned(decoder[i]) / factorDegree;
    const deltaLng = toSigned(decoder[i + 1]) / factorDegree;
    lastLat += deltaLat;
    lastLng += deltaLng;

    if (thirdDim) {
      const deltaZ = toSigned(decoder[i + 2]) / factorZ;
      lastZ += deltaZ;
      res.push([lastLat, lastLng, lastZ]);
      i += 3;
    } else {
      res.push([lastLat, lastLng]);
      i += 2;
    }
  }

  if (i !== decoder.length) {
    throw new Error('Invalid encoding. Premature ending reached');
  }

  return {
    ...header,
    polyline: res,
  };
}

function decodeChar(char) {
  const charCode = char.charCodeAt(0);
  return DECODING_TABLE[charCode - 45];
}

function toSigned(val) {
  // Decode the sign from an unsigned value
  let res = val;
  if (res & Num(1)) {
    res = ~res;
  }
  res >>= Num(1);
  return +res.toString();
}

function decodeUnsignedValues(encoded) {
  let result = Num(0);
  let shift = Num(0);
  const resList = [];

  encoded.split('').forEach((char) => {
    const value = Num(decodeChar(char));
    result |= (value & Num(0x1F)) << shift;
    if ((value & Num(0x20)) === Num(0)) {
      resList.push(result);
      result = Num(0);
      shift = Num(0);
    } else {
      shift += Num(5);
    }
  });

  if (shift > 0) {
    throw new Error('Invalid encoding');
  }

  return resList;
}

function decodeHeader(version, encodedHeader) {
  if (+version.toString() !== FORMAT_VERSION) {
    throw new Error('Invalid format version');
  }
  const headerNumber = +encodedHeader.toString();
  const precision = headerNumber & 15;
  const thirdDim = (headerNumber >> 4) & 7;
  const thirdDimPrecision = (headerNumber >> 7) & 15;
  return { precision, thirdDim, thirdDimPrecision };
}


Reactotron
    .setAsyncStorageHandler(AsyncStorage) // AsyncStorage would either come from `react-native` or `@react-native-community/async-storage` depending on where you get it from
    .configure() // controls connection & communication settings
    .useReactNative() // add all built-in react native plugins
    .connect() // let's connect!

export default function App() {
  const [startingLocation, setStartingLocation] = useState({
    latitude: "36.736596",
    longitude: "-119.786518",
  })
  const [finishLocation, setFinishLocation] = useState({
    latitude: "36.769558",
    longitude: "-119.786906",
  })
  const [routeCoordinates, setRouteCoordinates] = useState([])
  const [summary, setSummary] = useState()
  const [isLoading, setIsLoading] = useState(true)
  const [region, setRegion] = useState({
    latitude: parseFloat("36.736596"),
    longitude: parseFloat("-119.786518"),
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  })

  useEffect(() => {
    _getRoute();
  }, []);

  // I will create a function which will call this, you can call it whenever you want
  const _getRoute = () => {
    // we are using parseFloat() because HERE API expects a float
    let from_lat = parseFloat(startingLocation.latitude)
    let from_long = parseFloat(startingLocation.longitude)
    let to_lat = parseFloat(finishLocation.latitude)
    let to_long = parseFloat(finishLocation.longitude)
    // we will save all Polyline coordinates in this array
    let route_coordinates = []
    axios.get(`https://router.hereapi.com/v8/routes?transportMode=car&origin=${from_lat},${from_long}&destination=${to_lat},${to_long}&return=polyline&apiKey=QyUoUCtPp8P2CSTeGCvvZwE02ZZhz_fRemgyDHsMHF4`
).then(res => {
  console.log(res)
      let decodedPolyline=[];
      // here we are getting all route coordinates from API response
      res.data.routes[0].sections.map(m => {
        // here we are getting latitude and longitude in seperate variables because HERE sends it together, but we
        // need it seperate for <Polyline/>
        // let latlong = m.split(',');
        // let latitude = parseFloat(latlong[0]);
        // let longitude = parseFloat(latlong[1]);
        decodedPolyline = decode(m.polyline);
        console.log(decodedPolyline)
      })
      route_coordinates = decodedPolyline.polyline.map(r => {
        return {latitude: r[0], longitude: r[1]}
      })
      setRouteCoordinates(route_coordinates)
      // setSummary(res.data.response.route[0].summary,)
      setIsLoading(false)

    }).catch(err => {
      console.log(err)
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {isLoading ?
          <View>
          <Text>Open up App.js to start working on your app!</Text>
          <ActivityIndicator />
          </View>
          :
          <MapView
              style={{ height: 200, width: 200 }}
              initialRegion={{
                latitude: 36.736596,
                longitude: -119.786518,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1
              }}
          >
            <Polyline coordinates={routeCoordinates} />
            <Marker coordinate={{latitude: parseFloat(startingLocation.latitude), longitude: parseFloat(startingLocation.longitude)}} title="Starting location"/>
            <Marker coordinate={{latitude: parseFloat(finishLocation.latitude), longitude: parseFloat(finishLocation.longitude)}} title="Finishlocation"/>
          </MapView>
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
