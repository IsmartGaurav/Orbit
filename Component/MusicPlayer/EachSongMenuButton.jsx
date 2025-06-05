import { Pressable, findNodeHandle, UIManager, View, Modal, Text, TouchableOpacity, StyleSheet, Dimensions, ToastAndroid } from "react-native";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Octicons from 'react-native-vector-icons/Octicons';
import React, { useRef, useState, useContext, useEffect } from "react";
import { useTheme } from "@react-navigation/native";
import { StorageManager } from '../../Utils/StorageManager';
import ReactNativeBlobUtil from 'react-native-blob-util';
import TrackPlayer from 'react-native-track-player';
import Context from "../../Context/Context";
import { AddOneSongToPlaylist } from "../../MusicPlayerFunctions";
import PlaylistSelectorWrapper from '../Playlist/PlaylistSelectorWrapper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Circular Progress Component for download status
const CircularProgress = ({ progress, size = 30, thickness = 2, color = '#1DB954' }) => {
  // Calculate rotation based on progress
  const rotation = progress * 3.6; // 360 degrees / 100 = 3.6
  
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Background Circle */}
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thickness,
        borderColor: 'rgba(255,255,255,0.2)',
        position: 'absolute'
      }} />
      
      {/* Progress Circle - segments for visualization */}
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        position: 'absolute',
        borderWidth: thickness,
        borderTopColor: progress > 12.5 ? color : 'transparent',
        borderRightColor: progress > 37.5 ? color : 'transparent',
        borderBottomColor: progress > 62.5 ? color : 'transparent',
        borderLeftColor: progress > 87.5 ? color : 'transparent',
        transform: [{ rotate: `${rotation}deg` }]
      }} />
      
      {/* Center Text showing percentage */}
      <Text style={{
        color: 'white',
        fontSize: size / 3.5,
        fontWeight: 'bold'
      }}>{Math.round(progress)}%</Text>
    </View>
  );
};

export const EachSongMenuButton = ({ 
  song, 
  size = 18, 
  hitSlopSize = 18, 
  paddingSize = 4, 
  minWidth = 28, 
  marginRight = 10, 
  isFromAlbum = false, 
  isFromPlaylist = false,
  isDownloaded: propIsDownloaded = null // Accept isDownloaded as a prop
}) => {
  const { dark, colors } = useTheme();
  const buttonRef = useRef(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 20 });
  const { updateTrack } = useContext(Context);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(propIsDownloaded || false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Check if song is already downloaded when component mounts
  useEffect(() => {
    if (propIsDownloaded !== null) {
      // If prop is provided, use it
      setIsDownloaded(propIsDownloaded);
    } else if (song?.id) {
      // Otherwise check storage
      checkIfDownloaded(song.id);
    }
  }, [song?.id, propIsDownloaded]);
  
  // Function to check if a song is already downloaded
  const checkIfDownloaded = async (songId) => {
    try {
      if (!songId) return false;
      
      // Use StorageManager to check if song is downloaded
      const downloaded = await StorageManager.isSongDownloaded(songId);
      setIsDownloaded(downloaded);
      return downloaded;
    } catch (error) {
      console.error('Error checking download status:', error);
      return false;
    }
  };
  
  // Ensure we have a valid song object
  useEffect(() => {
    if (!song) {
      console.error('EachSongMenuButton received undefined song object');
    }
  }, [song]);

  // Calculate style based on context
  const getMarginRight = () => {
    if (isFromAlbum) return 2; // Reduced margin for albums
    if (isFromPlaylist) return 15; // Increased margin for playlists
    return marginRight; // Default for other contexts
  };

  // Calculate size based on context
  const getIconSize = () => {
    return isFromAlbum ? 18 : 20; // Slightly smaller for albums
  };

  const handlePress = () => {
    if (buttonRef.current) {
      const handle = findNodeHandle(buttonRef.current);
      UIManager.measure(handle, (x, y, width, height, pageX, pageY) => {
        // Calculate if menu would go off screen
        const menuHeight = 180; // Approximate height of menu
        const spaceBelow = SCREEN_HEIGHT - pageY - height;
        
        // If not enough space below, position menu above the button
        if (spaceBelow < menuHeight) {
          setMenuPosition({ 
            top: Math.max(pageY - menuHeight, 50),
            right: 20
          });
        } else {
          setMenuPosition({ 
            top: pageY + (height * 1.5),
            right: 20 
          });
        }
        
        setMenuVisible(true);
      });
    }
  };

  const closeMenu = () => {
    setMenuVisible(false);
  };
  
  const addToQueue = async () => {
    closeMenu();
    if (!song?.url) {
      ToastAndroid.show('No song URL available', ToastAndroid.SHORT);
      return;
    }

    try {
      // Get the actual URL from array if needed
      const songUrl = getHighestQualityUrl(song.url);
      console.log('Using URL for add to queue:', songUrl);
      
      if (!songUrl) {
        ToastAndroid.show('Invalid song URL format', ToastAndroid.SHORT);
        return;
      }
      
      // Add to queue using TrackPlayer
      await TrackPlayer.add({
        url: songUrl,
        title: song.title || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        artwork: song.artwork || song.image,
        id: song.id || Date.now().toString(),
        duration: song.duration || 0,
        language: song.language || '',
        artistID: song.artistID || ''
      });
      
      updateTrack();
      ToastAndroid.show(`Added ${song.title} to queue`, ToastAndroid.SHORT);
    } catch (error) {
      console.error('Error adding to queue:', error);
      ToastAndroid.show('Failed to add to queue', ToastAndroid.SHORT);
    }
  };

  const playNext = async () => {
    closeMenu();
    if (!song?.url) {
      ToastAndroid.show('No song URL available', ToastAndroid.SHORT);
      return;
    }

    try {
      // Get the actual URL from array if needed
      const songUrl = getHighestQualityUrl(song.url);
      console.log('Using URL for play next:', songUrl);
      
      if (!songUrl) {
        ToastAndroid.show('Invalid song URL format', ToastAndroid.SHORT);
        return;
      }
      
      // Format the track object
      const trackToAdd = {
        url: songUrl,
        title: song.title || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        artwork: song.artwork || song.image,
        id: song.id || Date.now().toString(),
        duration: song.duration || 0,
        language: song.language || '',
        artistID: song.artistID || ''
      };
      
      // Get current track index and queue
      const currentIndex = await TrackPlayer.getCurrentTrack();
      const queue = await TrackPlayer.getQueue();
      console.log('Current track index:', currentIndex);
      console.log('Current queue length:', queue.length);
      
      if (currentIndex === null || queue.length === 0) {
        // If no track is playing, just start playing this song
        await TrackPlayer.reset();
        await TrackPlayer.add([trackToAdd]);
        await TrackPlayer.play();
        console.log('Added song to empty queue and started playing:', trackToAdd.title);
      } else {
        // For play next, we need to insert right after the current playing track
        // First, remove the track if it already exists in the queue to avoid duplicates
        const existingIndex = queue.findIndex(track => track.id === trackToAdd.id);
        if (existingIndex !== -1) {
          await TrackPlayer.remove(existingIndex);
          // Need to get the updated current index in case we removed a track before it
          const updatedCurrentIndex = await TrackPlayer.getCurrentTrack();
          await TrackPlayer.add([trackToAdd], updatedCurrentIndex + 1);
        } else {
          // Insert right after current track
          await TrackPlayer.add([trackToAdd], currentIndex + 1);
        }
        console.log('Added song to play next at position', currentIndex + 1);
      }
      
      updateTrack();
      ToastAndroid.show(`${song.title} will play next`, ToastAndroid.SHORT);
    } catch (error) {
      console.error('Error setting play next:', error);
      // Try a more basic approach if the first method fails
      try {
        const songUrl = getHighestQualityUrl(song.url);
        
        if (!songUrl) {
          ToastAndroid.show('Invalid song URL format', ToastAndroid.SHORT);
          return;
        }
        
        const queue = await TrackPlayer.getQueue();
        
        // Check if any track is playing
        const currentTrack = await TrackPlayer.getCurrentTrack();
        
        if (currentTrack === null || queue.length === 0) {
          // If nothing playing, just add and play
          await TrackPlayer.add({
            url: songUrl,
            title: song.title || 'Unknown',
            artist: song.artist || 'Unknown',
            artwork: song.artwork || song.image,
            id: song.id || Date.now().toString()
          });
          await TrackPlayer.play();
        } else {
          // Insert at index 1 (after current track at index 0)
          await TrackPlayer.add({
            url: songUrl,
            title: song.title || 'Unknown',
            artist: song.artist || 'Unknown',
            artwork: song.artwork || song.image,
            id: song.id || Date.now().toString()
          }, currentTrack + 1);
        }
        
        ToastAndroid.show(`${song.title} will play next`, ToastAndroid.SHORT);
        updateTrack();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        ToastAndroid.show('Failed to set play next', ToastAndroid.SHORT);
      }
    }
  };

  const addToPlaylist = async () => {
    closeMenu();
    if (!song?.id) {
      ToastAndroid.show('Song information not available', ToastAndroid.SHORT);
      return;
    }

    try {
      // Call the function to add song to playlist
      const result = await AddOneSongToPlaylist(song);
      if (!result) {
        ToastAndroid.show('Failed to open playlist selector', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('Error adding to playlist:', error);
      ToastAndroid.show('Failed to add to playlist', ToastAndroid.SHORT);
    }
  };
  
  const downloadSong = async () => {
    // Close menu if it's open
    if (menuVisible) {
    closeMenu();
    }
    
    if (!song?.url) {
      ToastAndroid.show('No song URL available', ToastAndroid.SHORT);
      return;
    }

    try {
      // Check if already downloaded or downloading
      if (isDownloaded) {
        ToastAndroid.show(`Song already downloaded`, ToastAndroid.SHORT);
        return;
      }
      
      if (isDownloading) {
        ToastAndroid.show(`Download in progress: ${downloadProgress}%`, ToastAndroid.SHORT);
        return;
      }
      
      setIsDownloading(true);
      setDownloadProgress(0);
      console.log('Starting download for:', song.title);
      
      // Get highest quality URL
      const downloadUrl = getHighestQualityUrl(song.url);
      if (!downloadUrl) {
        console.error('Could not determine download URL');
        ToastAndroid.show('Could not determine download URL', ToastAndroid.SHORT);
        setIsDownloading(false);
        return;
      }
      
      // Show download started toast
      ToastAndroid.show(`Downloading: ${song.title}`, ToastAndroid.SHORT);

      // Ensure directories exist
      try {
        await StorageManager.ensureDirectoriesExist();
      } catch (dirError) {
        console.error('Error creating directories:', dirError);
        ToastAndroid.show('Error creating download directories', ToastAndroid.SHORT);
        setIsDownloading(false);
        return;
      }

      // Prepare safe metadata
      const safeMetadata = {
        id: song.id || Date.now().toString(),
        title: song.title || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        duration: song.duration || 0,
        artwork: song.artwork || song.image,
        downloadTime: Date.now()
      };

        // First save basic metadata
        await StorageManager.saveDownloadedSongMetadata(safeMetadata.id, safeMetadata);

      // Download the song
      const songPath = StorageManager.getSongPath(safeMetadata.id);
      
      try {
        const res = await ReactNativeBlobUtil
          .config({
            fileCache: false,
            path: songPath,
          })
          .fetch('GET', downloadUrl)
          .progress((received, total) => {
            // Update progress percentage
            if(total > 0) {
              const percentage = Math.floor((received / total) * 100);
              setDownloadProgress(percentage);
            }
          });
        
        console.log('Song download completed');
        
        // Now download artwork if available
        if (song.artwork && typeof song.artwork === 'string') {
          try {
            const artworkPath = await StorageManager.saveArtwork(safeMetadata.id, song.artwork);
          if (artworkPath) {
              safeMetadata.localArtworkPath = artworkPath;
            }
          } catch (artworkError) {
            console.warn('Error saving artwork:', artworkError);
          }
        }
        
        // Update metadata with success
          await StorageManager.saveDownloadedSongMetadata(safeMetadata.id, {
            ...safeMetadata,
            localSongPath: songPath,
            downloadComplete: true,
            downloadCompletedTime: Date.now()
          });
        
        // Show success toast
        ToastAndroid.show("Download complete", ToastAndroid.SHORT);
        
        // Update state to show downloaded icon
        setIsDownloaded(true);
        setIsDownloading(false);
        setDownloadProgress(0);

        // Update download list in AsyncStorage
        try {
          const existingData = await AsyncStorage.getItem('orbit_downloaded_songs');
          const downloadsList = existingData ? JSON.parse(existingData) : [];
          
          if (!downloadsList.some(item => item.id === safeMetadata.id)) {
            downloadsList.push({
              id: safeMetadata.id,
              name: safeMetadata.title,
              artists: safeMetadata.artist,
              image: safeMetadata.artwork,
              duration: safeMetadata.duration
            });
            await AsyncStorage.setItem('orbit_downloaded_songs', JSON.stringify(downloadsList));
          }
        } catch (updateError) {
          console.log('Error updating downloads list:', updateError);
        }
      } catch (downloadError) {
        console.error('Download failed:', downloadError);
        
        // Clean up any partial downloads
        try {
          if (await RNFS.exists(songPath)) {
            await RNFS.unlink(songPath);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up failed download:', cleanupError);
        }
        
        // Show error toast
        ToastAndroid.show("Download failed", ToastAndroid.SHORT);
        setIsDownloading(false);
        setDownloadProgress(0);
      }
    } catch (error) {
      console.error('Unexpected error during download:', error);
      ToastAndroid.show("Download failed", ToastAndroid.SHORT);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Helper function to get highest quality URL from an array of URL objects
  const getHighestQualityUrl = (urlData) => {
    try {
    console.log('Processing URL data type:', typeof urlData);
      
      // If it's undefined or null, handle the error gracefully
      if (urlData == null) {
        console.error('URL data is null or undefined');
        return null;
      }
    
    // If it's already a string, return it
    if (typeof urlData === 'string') {
      return urlData;
    }
    
    // If it's an array of quality objects
    if (Array.isArray(urlData)) {
        // Safety check for empty array
        if (urlData.length === 0) {
          console.error('URL data array is empty');
          return null;
        }
        
      try {
        // Check if the first item has a quality property (Saavn format)
        if (urlData[0] && typeof urlData[0] === 'object' && 'quality' in urlData[0]) {
          // Sort by quality (assuming quality is in format like "320kbps")
          const sortedUrls = [...urlData].sort((a, b) => {
            // Extract numbers from quality strings
            const qualityA = parseInt(a.quality?.replace(/[^\d]/g, '') || 0);
            const qualityB = parseInt(b.quality?.replace(/[^\d]/g, '') || 0);
            return qualityB - qualityA; // Descending order
          });
          
          console.log('Selected highest quality:', sortedUrls[0]?.quality);
          return sortedUrls[0]?.url || '';
        } 
        // If it's just an array of URLs, return the first one
        else if (typeof urlData[0] === 'string') {
          return urlData[0];
        }
        // If it's a different format with URL property
        else if (urlData[0] && typeof urlData[0] === 'object' && 'url' in urlData[0]) {
          return urlData[0].url;
        }
          // Special case for local files or downloaded files
          else if (urlData[0] && typeof urlData[0] === 'object' && (
            urlData[0].filePath || urlData[0].localFilePath
          )) {
            return urlData[0].filePath || urlData[0].localFilePath;
        }
      } catch (error) {
        console.error('Error parsing URL array:', error);
        // Fallback to first item if possible
        if (urlData[0]) {
            if (typeof urlData[0] === 'string') return urlData[0];
            if (urlData[0].url) return urlData[0].url;
            if (urlData[0].filePath) return urlData[0].filePath;
            if (urlData[0].localFilePath) return urlData[0].localFilePath;
          }
          return null;
      }
    }
    
    // Handle object with multiple URLs
    if (urlData && typeof urlData === 'object') {
      // Check for common URL properties in different formats
      if ('url' in urlData) return urlData.url;
        if ('filePath' in urlData) return urlData.filePath;
        if ('localFilePath' in urlData) return urlData.localFilePath;
      if ('320kbps' in urlData) return urlData['320kbps'];
      if ('160kbps' in urlData) return urlData['160kbps'];
      if ('96kbps' in urlData) return urlData['96kbps'];
      if ('48kbps' in urlData) return urlData['48kbps'];
      
      // Try to find any property that looks like a URL
      for (const key in urlData) {
        if (typeof urlData[key] === 'string' && 
            (urlData[key].startsWith('http') || urlData[key].startsWith('file:'))) {
          return urlData[key];
        }
      }
    }
    
    // Unknown format, return empty string
      console.error('Could not determine URL from provided data');
      return null;
    } catch (error) {
      console.error('Critical error in getHighestQualityUrl:', error);
      return null;
    }
  };

  // For the menu dropdown options, use consistent icons and sizing
  const renderMenu = () => (
    <Modal
      transparent
      visible={menuVisible}
      onRequestClose={closeMenu}
      animationType="fade"
    >
      <Pressable style={styles.modalOverlay} onPress={closeMenu}>
        <View style={[styles.menuContainer, { top: menuPosition.top, right: menuPosition.right, backgroundColor: dark ? '#1E1E1E' : '#FFFFFF' }]}>
          <TouchableOpacity style={styles.menuItem} onPress={addToQueue}>
            <MaterialCommunityIcons name="playlist-plus" size={24} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Add to queue</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={playNext}>
            <MaterialCommunityIcons name="play-speed" size={24} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Play next</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={addToPlaylist}>
            <MaterialCommunityIcons name="playlist-music" size={24} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Add to playlist</Text>
          </TouchableOpacity>
          
          {!isDownloaded && (
            <TouchableOpacity style={styles.menuItem} onPress={downloadSong}>
              <Octicons name="download" size={24} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>Download</Text>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Three dots menu button */}
        <Pressable
          ref={buttonRef}
          onPress={handlePress}
          style={{
            padding: paddingSize,
            alignItems: 'center',
            justifyContent: 'center',
            width: isFromAlbum ? 38 : 32,
            height: isFromAlbum ? 38 : 32,
            backgroundColor: 'transparent',
            borderRadius: 16,
            elevation: 0,
            marginRight: isFromAlbum ? 0 : getMarginRight() + 5,
          }}
          android_ripple={{ 
            color: 'rgba(255, 255, 255, 0.2)', 
            borderless: true, 
            radius: isFromAlbum ? 18 : 20
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={isFromAlbum ? 24 : 20}
            color={colors.text} 
          />
        </Pressable>
      </View>
      
      {/* Show playlist selector if needed */}
      {showPlaylistSelector && (
        <PlaylistSelectorWrapper 
          songToAdd={song} 
          onClose={() => setShowPlaylistSelector(false)} 
        />
      )}

      {renderMenu()}
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuContainer: {
    position: 'absolute',
    right: 20,
    // backgroundColor: '#1E1E1E', // Will be set dynamically
    borderRadius: 8,
    padding: 8,
    minWidth: 180,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  menuText: {
    marginLeft: 10,
    fontSize: 14,
  },
  menuIcon: {
    opacity: 1, // Ensure full opacity
    marginRight: 8,
  },
});
