import Context from "./Context";
import { useEffect, useState } from "react";
import TrackPlayer, { Event, useTrackPlayerEvents } from "react-native-track-player";
import { getRecommendedSongs } from "../Api/Recommended";
import { AddSongsToQueue } from "../MusicPlayerFunctions";
import FormatArtist from "../Utils/FormatArtists";
import { Repeats } from "../Utils/Repeats";
import { SetQueueSongs } from "../LocalStorage/storeQueue";
import { EachSongMenuModal } from "../Component/Global/EachSongMenuModal";
import { CacheManager } from "../Utils/CacheManager";


const events = [
    Event.PlaybackActiveTrackChanged,
    Event.PlaybackError,
    Event.PlaybackState,
];
const ContextState = (props)=>{
    const [Index, setIndex] = useState(0);
    const [QueueIndex, setQueueIndex] = useState(0);
    const [currentPlaying, setCurrentPlaying]  = useState({})
    const [Repeat, setRepeat] = useState(Repeats.NoRepeat);
    const [Visible, setVisible] = useState({
        visible:false,
    });
    const [previousScreen, setPreviousScreen] = useState(null);
    // Dedicated state for music player navigation - won't be affected by general navigation
    const [musicPreviousScreen, setMusicPreviousScreen] = useState("");
    
    // Add state to track the current playlist information
    const [currentPlaylistData, setCurrentPlaylistData] = useState(null);
    
    // Add state to track liked playlists for UI updates
    const [likedPlaylists, setLikedPlaylists] = useState([]);

    const [Queue, setQueue] = useState([]);
    async function updateTrack (){
        const tracks = await TrackPlayer.getQueue();
        // await SetQueueSongs(tracks)
        console.log(tracks);
        const ids = tracks.map((e)=>e.id)
        const queuesId = Queue.map((e)=>e.id)
        if (JSON.stringify(ids) !== JSON.stringify(queuesId)){
            setQueue(tracks)
        }
    }
    
    // Function to update liked playlists state and trigger UI updates
    function updateLikedPlaylist() {
        // This is just to trigger rerenders when playlists are liked/unliked
        setLikedPlaylists(prev => [...prev]);
    }
    
    async function AddRecommendedSongs(index,id){
        const tracks = await TrackPlayer.getQueue();
        const totalTracks = tracks.length - 1
        if (index >= totalTracks - 2){
           try {
               const songs = await getRecommendedSongs(id)
               if (songs?.data?.length !== 0){
                   const ForMusicPlayer = songs.data.map((e)=> {
                       return {
                           url:e.downloadUrl[3].url,
                           title:e.name.toString().replaceAll("&quot;","\"").replaceAll("&amp;","and").replaceAll("&#039;","'").replaceAll("&trade;","™"),
                           artist:FormatArtist(e?.artists?.primary).toString().replaceAll("&quot;","\"").replaceAll("&amp;","and").replaceAll("&#039;","'").replaceAll("&trade;","™"),
                           artwork:e.image[2].url,
                           duration:e.duration,
                           id:e.id,
                           language:e.language,
                       }
                   })
                   await AddSongsToQueue(ForMusicPlayer)
               }
           } catch (e) {
               console.log(e);
           } finally {
               await updateTrack()
           }
        }
    }

    useTrackPlayerEvents(events, (event) => {
        if (event.type === Event.PlaybackError) {
            console.warn('An error occured while playing the current track.');
        }
        if (event.type === Event.PlaybackActiveTrackChanged) {
            setCurrentPlaying(event.track)
            if (Repeat === Repeats.NoRepeat){
                if (event.track?.id ){
                    AddRecommendedSongs(event.index,event.track?.id)
                }
            }
        }
    });
    async function InitialSetup(){
        try {
            // Clear old cache entries to prevent storage full errors
            await CacheManager.clearOldCacheEntries();
            
            await TrackPlayer.setupPlayer()
            console.log('Player initialized successfully in Context');
        } catch (error) {
            // Ignore the error if player is already initialized
            if (error.message && error.message.includes('player has already been initialized')) {
                console.log('Player already initialized in Context');
            } else {
                console.error('Error initializing player in Context:', error);
            }
        }
        
        await updateTrack()
        await getCurrentSong()
    }
    async function getCurrentSong(){
        const song = await TrackPlayer.getActiveTrack()
        setCurrentPlaying(song)
    }
    useEffect(() => {
        InitialSetup()
    }, []);
    return <Context.Provider value={{
        currentPlaying,  
        Repeat, 
        setRepeat, 
        updateTrack, 
        Index, 
        setIndex, 
        QueueIndex, 
        setQueueIndex, 
        setVisible, 
        Queue, 
        previousScreen, 
        setPreviousScreen,
        musicPreviousScreen,
        setMusicPreviousScreen,
        currentPlaylistData,
        setCurrentPlaylistData,
        updateLikedPlaylist,
        likedPlaylists
    }}>
        {props.children}
         <EachSongMenuModal setVisible={setVisible} Visible={Visible}/>
    </Context.Provider>
}

export default  ContextState
