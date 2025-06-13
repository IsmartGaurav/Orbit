import { View, TouchableOpacity, ToastAndroid, StyleSheet } from "react-native";
import AntDesign from "react-native-vector-icons/AntDesign";
import { useState, useEffect } from "react";
import { useTheme } from "@react-navigation/native";
import { SmallText } from "./SmallText";
import { PermissionsAndroid, Platform } from "react-native";
import DeviceInfo from "react-native-device-info";
import { StorageManager } from '../../Utils/StorageManager';
import { UnifiedDownloadService } from '../../Utils/UnifiedDownloadService';
import EventRegister from '../../Utils/EventRegister';

// Circular progress component for download indicator
const CircularProgress = ({ progress, size = 20, thickness = 2, color = '#1DB954' }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Background circle */}
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
      }}>
        {/* Filled portion based on progress */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${progress}%`,
          backgroundColor: color,
        }} />
        
        {/* Percentage text */}
        <SmallText
          text={`${Math.round(progress)}%`}
          style={{
            fontSize: size <= 30 ? 8 : 12,
            color: 'white',
            fontWeight: 'bold',
            textShadowColor: 'rgba(0,0,0,0.75)',
            textShadowOffset: {width: 0, height: 1},
            textShadowRadius: 2
          }}
        />
      </View>
    </View>
  );
};

export const DownloadButton = ({ 
  songs = [], 
  albumName = "", 
  size = "normal", 
  individual = false,
  songId = null 
}) => {
  const { colors } = useTheme();
  const [downloadStatus, setDownloadStatus] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  
  // Determine button size based on prop
  const buttonSize = size === "large" ? 48 : size === "small" ? 36 : 44;
  const iconSize = size === "large" ? 30 : size === "small" ? 22 : 26;
  const progressSize = size === "large" ? 38 : size === "small" ? 30 : 34;
  
  // Check download status on mount
  useEffect(() => {
    const checkDownloadedItems = async () => {
      if (individual && songId) {
        // For individual song
        const isDownloaded = await StorageManager.isSongDownloaded(songId);
        setDownloadStatus({
          [songId]: {
            isDownloaded,
            progress: isDownloaded ? 100 : 0,
            isDownloading: false
          }
        });
        setOverallProgress(isDownloaded ? 100 : 0);
      } else if (songs && songs.length > 0) {
        // For album/playlist
        const songStatuses = {};
        let downloadedCount = 0;
        
        // Check each song's download status
        for (const song of songs) {
          if (!song || !song.id) continue;
          
          const isDownloaded = await StorageManager.isSongDownloaded(song.id);
          songStatuses[song.id] = {
            isDownloaded,
            progress: isDownloaded ? 100 : 0,
            isDownloading: false
          };
          
          if (isDownloaded) {
            downloadedCount++;
          }
        }
        
        setDownloadStatus(songStatuses);
        
        // If all songs are downloaded, set overall progress to 100%
        if (downloadedCount === songs.length) {
          setOverallProgress(100);
        } else {
          setOverallProgress(Math.floor((downloadedCount / songs.length) * 100));
        }
      }
    };
    
    checkDownloadedItems();
  }, [songs, individual, songId]);
  
  // Get storage permissions (for Android)
  const getPermission = async () => {
    try {
      if (Platform.OS === 'ios') {
        handleDownload();
        return;
      }
      
      const deviceVersion = DeviceInfo.getSystemVersion();
      
      if (parseInt(deviceVersion) >= 13) {
        handleDownload();
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: "Storage Permission",
            message: "Orbit needs storage access to save music for offline playback",
            buttonPositive: "Allow",
            buttonNegative: "Cancel"
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          handleDownload();
        } else {
          Alert.alert(
            "Permission Denied",
            "Storage permission is required to download songs. Please enable it in app settings."
          );
        }
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Could not request storage permissions');
    }
  };
  
  // Handle download logic
  const handleDownload = async () => {
    if (isDownloading) {
      ToastAndroid.show('Download already in progress', ToastAndroid.SHORT);
      return;
    }
    
    try {
      // For individual songs
      if (individual && songId) {
        const song = songs.find(s => s.id === songId);
        if (!song) {
          ToastAndroid.show('Invalid song data', ToastAndroid.SHORT);
          return;
        }
        
        // Check if already downloaded
        const isDownloaded = await StorageManager.isSongDownloaded(songId);
        if (isDownloaded) {
          ToastAndroid.show('Song already downloaded', ToastAndroid.SHORT);
          return;
        }
        
        setIsDownloading(true);
        await downloadSong(song, albumName);
        setIsDownloading(false);
        return;
      }
      
      // For albums/playlists
      // Check if all songs are already downloaded
      const allDownloaded = Object.values(downloadStatus).every(status => status.isDownloaded);
      if (allDownloaded) {
        ToastAndroid.show('All songs already downloaded', ToastAndroid.SHORT);
        return;
      }
      
      setIsDownloading(true);
      ToastAndroid.show(`Downloading ${songs.length} songs`, ToastAndroid.SHORT);

      let completedDownloads = 0;
      
      // Download songs in parallel (max 3 at a time)
      const chunks = [];
      const songsToDownload = [...songs];
      const chunkSize = 3;
      
      while (songsToDownload.length > 0) {
        chunks.push(songsToDownload.splice(0, chunkSize));
      }
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (song) => {
          // Skip already downloaded songs
          if (!song || !song.id || downloadStatus[song.id]?.isDownloaded) {
            completedDownloads++;
            setOverallProgress(Math.floor((completedDownloads / songs.length) * 100));
            return;
          }
          
          // Mark song as downloading
          setDownloadStatus(prev => ({
            ...prev,
            [song.id]: {
              ...prev[song.id],
              isDownloading: true
            }
          }));
          
          try {
            await downloadSong(song, albumName, completedDownloads, songs.length);
            completedDownloads++;
            setOverallProgress(Math.floor((completedDownloads / songs.length) * 100));
          } catch (error) {
            console.error(`Error downloading song:`, error);
          }
        }));
      }
      
      ToastAndroid.show('Download complete', ToastAndroid.SHORT);
    } catch (error) {
      console.error('Error downloading:', error);
      Alert.alert('Download Error', 'There was an error downloading');
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Function to download a single song using unified service
  const downloadSong = async (song, albumName, completedCount = 0, totalCount = 1) => {
    try {
      // Prepare song data for unified service
      const songData = {
        id: song.id,
        title: song.name || song.title || 'Unknown',
        artist: song.artists?.primary || song.artist || 'Unknown',
        album: albumName || 'Unknown',
        downloadUrl: song.downloadUrl,
        download_url: song.download_url,
        url: song.url,
        image: song.image,
        artwork: song.artwork,
        duration: song.duration || 0
      };

      // Use unified download service with progress callback
      const success = await UnifiedDownloadService.downloadSong(songData, (progress) => {
        // Update progress for this specific song
        setDownloadStatus(prev => ({
          ...prev,
          [song.id]: {
            ...prev[song.id],
            progress: progress
          }
        }));

        // For individual song download, update overall progress
        if (individual || totalCount === 1) {
          setOverallProgress(progress);
        }
      });

      if (success) {
        // Mark as downloaded
        setDownloadStatus(prev => ({
          ...prev,
          [song.id]: {
            isDownloaded: true,
            progress: 100,
            isDownloading: false
          }
        }));
      } else {
        // Mark as failed
        setDownloadStatus(prev => ({
          ...prev,
          [song.id]: {
            ...prev[song.id],
            isDownloading: false
          }
        }));
      }

      return success;
    } catch (error) {
      console.error(`Error downloading song ${song.name}:`, error);

      // Mark as failed
      setDownloadStatus(prev => ({
        ...prev,
        [song.id]: {
          ...prev[song.id],
          isDownloading: false
        }
      }));

      return false;
    }
  };
  
  // Render the appropriate button based on state
  const renderButton = () => {
    if (isDownloading) {
      return (
        <View style={{ 
          width: buttonSize, 
          height: buttonSize, 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <CircularProgress progress={overallProgress} size={progressSize} thickness={2} />
        </View>
      );
    }
    
    // If individual song
    if (individual && songId) {
      const isDownloaded = downloadStatus[songId]?.isDownloaded;
      
      if (isDownloaded) {
        return <AntDesign name="checkcircle" size={iconSize} color="#4CAF50" />;
      }
      
      return <AntDesign name="download" size={iconSize} color={colors.text} />;
    }
    
    // For albums/playlists
    const allDownloaded = songs.length > 0 && Object.keys(downloadStatus).length > 0 && 
                          Object.values(downloadStatus).every(status => status.isDownloaded);
    
    if (allDownloaded) {
      return <AntDesign name="checkcircle" size={iconSize} color="#4CAF50" />;
    }
    
    return <AntDesign name="download" size={iconSize} color="#FFFFFF" />;
  };
  
  return (
    <TouchableOpacity 
      style={[
        styles.container,
        { width: buttonSize, height: buttonSize },
        size === "small" ? styles.smallContainer : null
      ]}
      onPress={!isDownloading ? getPermission : undefined}
      disabled={isDownloading}
      activeOpacity={0.7}
    >
      {renderButton()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 3,
  },
  smallContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  }
}); 