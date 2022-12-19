import Map, {
  Layer,
  LayerProps,
  MapProvider,
  Marker,
  MarkerDragEvent,
  NavigationControl,
  Source,
  useMap
} from "react-map-gl";
import {ChangeEvent, useEffect, useState} from "react";
import {Feature} from "geojson";
import 'mapbox-gl/dist/mapbox-gl.css';
import {bbox} from '@turf/turf'
import {Profile} from "../types/Profile";
import {LatLng} from "../types/LatLng";
import Pin from "../components/pin";

const layerStyle: LayerProps = {
  id: 'route',
  type: 'line',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#3887be',
    'line-width': 5,
    'line-opacity': 0.75,
  }
}
//https://mapfan.com/spots/SCH,J,VW0
//Tokyo Station
const defaultPosition = {lng: 139.7673068, lat: 35.6809591}

const latLngToCoordStr = ({lat, lng}: { lat: number; lng: number }) => {
  return `${lng},${lat};`
}

const HomeContent = () => {
  const {myMap} = useMap();
  const [profile, setProfile] = useState<Profile>('driving');
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [waypoint, setWaypoint] = useState<LatLng | null>(null);
  const [useWayPoint,setUseWayPoint] = useState(false);
  const [routeGeoJson, setRouteGeoJson] = useState<Feature>();
  const [isNavigationMode, setIsNavigationMode] = useState(false)
  const [currentUserPosition, setCurrentUserPosition] = useState<LatLng | null>(null);

  const getCurrentPosition = (): Promise<{ lat: number, lng: number }> => {
    return new Promise<{ lat: number, lng: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(position => {
          const {latitude, longitude} = position.coords;
          resolve({lat: latitude, lng: longitude})
        },
        (error) => {
          reject(defaultPosition)
        },
        {enableHighAccuracy: true, timeout: 10000, maximumAge: 0});
    })
  };

  const onStartNavigation = () => {
    setIsNavigationMode(true)
  }

  const onFinishNavigation = () => {
    setIsNavigationMode(false)
  }

  const onClick = (event: mapboxgl.MapLayerMouseEvent) => {
    if (isNavigationMode) return;
    setDestination({lat: event.lngLat.lat, lng: event.lngLat.lng})
  }

  const onChangeUseWaypoint = (e:ChangeEvent<HTMLSelectElement>)=>{
    setIsNavigationMode(false)
    setUseWayPoint(Number(e.target.value)===1)
    if(!myMap)return;
    const center = myMap.getCenter();
    setWaypoint({lng: center.lng + 0.001, lat: center.lat + 0.001})
  }

  const onDragWaypoint = (e:MarkerDragEvent)=>{
    setIsNavigationMode(false)
    setRouteGeoJson(undefined)
    setWaypoint(e.lngLat)
  }

  useEffect(() => {
    getCurrentPosition().then(setCurrentUserPosition).catch(setCurrentUserPosition)
  }, [])

  useEffect(()=>{
    if(!isNavigationMode) setRouteGeoJson(undefined)
  },[isNavigationMode])

  useEffect(() => {
    if (!myMap || !isNavigationMode) return;
    if (currentUserPosition && destination) {
      (async () => {
        const wayPointCoord = useWayPoint&&waypoint?latLngToCoordStr(waypoint):''
        const coords=`${currentUserPosition.lng},${currentUserPosition.lat};${wayPointCoord}${destination.lng},${destination.lat}`
        const query = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?steps=true&geometries=geojson&language=ja&access_token=${process.env.NEXT_PUBLIC_MAP_BOX_TOKEN}`,
          {method: 'GET'},
        );
        const json = await query.json();
        const data = json.routes[0];
        const route = data.geometry.coordinates;
        const geojson = {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: route,
          },
        };
        setRouteGeoJson(geojson);
        myMap.fitBounds(bbox(geojson) as [number, number, number, number], {
          duration: 1000,
          padding: 200
        })
      })();
    }
  }, [profile, isNavigationMode, destination]);

  return (
    <div>
      <div style={{padding: 8, display: 'flex', alignItems: 'center', gap: 10}}>
        <div style={{display:'flex',gap:4}}>
          <p>By</p>
          <select onChange={(e) => setProfile(e.target.value as Profile)}>
          <option value="walking">walking</option>
          <option value="driving">car</option>
          </select>
        </div>
        <div style={{display:'flex',gap:4}}>
          <p>WayPoint</p>
          <select defaultValue={Number(useWayPoint)} onChange={onChangeUseWaypoint}>
            <option value={1}>Enabled</option>
            <option value={0}>Disabled</option>
          </select>
        </div>
        <div style={{display:'flex',gap:4}}>
          <button disabled={!destination || isNavigationMode} onClick={onStartNavigation}>Start Navigation</button>
          <button disabled={!isNavigationMode} onClick={onFinishNavigation}>End Navigation</button>
        </div>
        <span>Drop the destination pin by clicking on the map. You can also drop a draggable waypoint pin by enabling it.</span>
      </div>
      {currentUserPosition &&
      <Map
        id='myMap'
        initialViewState={{
          longitude: currentUserPosition.lng,
          latitude: currentUserPosition.lat,
          zoom: 14,
        }}
        style={{width: '100%', height: '100vh'}}
        mapStyle={"mapbox://styles/mapbox/light-v10"}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAP_BOX_TOKEN}
        onClick={onClick}
      >
        {destination &&
        <Marker key={'destination'} longitude={destination.lng} latitude={destination.lat} anchor="center">
          <Pin/>
        </Marker>
        }
        {routeGeoJson && (
          <Source id='myRoute' type='geojson' data={routeGeoJson}>
            <Layer {...layerStyle} />
          </Source>
        )}
        <NavigationControl/>
        {currentUserPosition &&
        <Marker key={'currentPosition'} longitude={currentUserPosition.lng} latitude={currentUserPosition.lat}
                anchor="center">
          <Pin color={'blue'}/>
        </Marker>
        }
        {useWayPoint && waypoint &&
        <Marker draggable={true} onDrag={onDragWaypoint} key={'dummyWaypoint'} longitude={waypoint.lng}
                latitude={waypoint.lat} anchor="center">
          <Pin color={'green'}/>
        </Marker>
        }
      </Map>
      }
    </div>
  )
}

const Home = () => (
  <MapProvider>
    <HomeContent/>
  </MapProvider>
)

export default Home
