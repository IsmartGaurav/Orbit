import { Pressable, View, Dimensions, ToastAndroid } from "react-native";
import FastImage from "react-native-fast-image";
import { PlainText } from "../Global/PlainText";
import { SmallText } from "../Global/SmallText";
import { memo, useState } from "react";
import { useActiveTrack, usePlaybackState } from "react-native-track-player";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useThemeContext } from "../../Context/ThemeContext";
import { useThemeManager } from "./ThemeManager/useThemeManager";
import { useDownload } from "../Download/useDownload";
import { DownloadControl } from "../Download/DownloadControl";
import TrackPlayer from "react-native-track-player";

// Get screen dimensions for responsive layout
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const EachSongQueue = memo(function EachSongQueue({ title, artist, index, artwork, id, drag, isActive, onPress, songData, onRemoveFromQueue }) {
  const playerState = usePlaybackState();
  const currentPlaying = useActiveTrack();
  const { theme, themeMode } = useThemeContext();
  const { getOpacityColor } = useThemeManager();

  // No longer need menu state since we're using direct trash icon

  // Download functionality
  const {
    isDownloaded,
    isDownloading,
    downloadProgress,
    startDownload,
    canDownload
  } = useDownload(songData || { id, title, artist, artwork }, false);

  // Check if this is the currently playing track
  const isCurrentTrack = id === currentPlaying?.id;
  
  // Determine the image source
  const getImageSource = () => {
    try {
      // Check if this is the current track and get appropriate animation
      if (isCurrentTrack) {
        return playerState.state === "playing" 
          ? require("../../Images/playing.gif") 
          : require("../../Images/songPaused.gif");
      }
      
      // For other tracks, handle different artwork formats
      if (!artwork) {
        // Use static image instead of animated GIF
        return getDefaultImage();
      }
      
      // Handle numeric artwork values (which come from local files)
      if (typeof artwork === 'number') {
        return artwork; // If it's a require() result, return it directly
      }
      
      // Handle artwork as object with URI
      if (typeof artwork === 'object' && artwork.uri) {
        // Ensure URI is not null or undefined
        if (!artwork.uri) {
          // Use static image instead of animated GIF
          return getDefaultImage();
        }
        return artwork;
      }
      
      // Handle local file paths for downloaded songs
      if (typeof artwork === 'string') {
        // Check if it's a local file path that needs file:// prefix
        if (artwork.startsWith('/') && !artwork.startsWith('file://')) {
          return { uri: `file://${artwork}` };
        }
        
        // Handle file:// paths
        if (artwork.startsWith('file://')) {
          return { uri: artwork };
        }
        
        // Handle remote URLs
        return { uri: artwork };
      }
      
      // Default fallback - use static image instead of animated GIF
      return getDefaultImage();
    } catch (error) {
      console.log('Error getting image source:', error);
      return getDefaultImage(); // Static image fallback
    }
  };
  
  // Function to get a default image for songs without artwork
  const getDefaultImage = () => {
    // Use static image instead of animated GIFs in queue view
    return require('../../Images/Music.jpeg');
  };
  
  // Handle special characters in text
  const formatText = (text) => {
    if (!text) return 'Unknown';
    return text.toString()
      .replaceAll("&quot;", "\"")
      .replaceAll("&amp;", "and")
      .replaceAll("&#039;", "'")
      .replaceAll("&trade;", "™");
  };
  
  // Truncate text to 20 characters
  const truncateText = (text, limit = 20) => {
    if (!text) return 'Unknown';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
  };
  
  // Calculate max text width based on screen size (accounting for download button and three-dot menu)
  const maxTextWidth = SCREEN_WIDTH - 140; // 48px for image + 12px gap + download button + three-dot menu + padding
  
  // Handle long press with immediate feedback
  const handleLongPress = () => {
    try {
      // Only call drag if it exists and is a function
      if (typeof drag === 'function') {
        // Provide haptic feedback if available
        if (global.HapticFeedback) {
          global.HapticFeedback.impactMedium();
        }
        console.log('Long press activated - starting drag');
        drag();
      }
    } catch (error) {
      console.error('Error in long press handler:', error);
    }
  };
  
  // Only add drag functionality if drag function is provided
  const dragHandlers = typeof drag === 'function' ? {
    onLongPress: handleLongPress,
    delayLongPress: 100
  } : {};
  
  // Handle track selection with safer approach
  const handlePress = () => {
    try {
      if (typeof onPress === 'function') {
        console.log(`Queue item pressed: ${title} (${id})`);
        onPress();
      } else {
        console.warn('Song press handler not available');
      }
    } catch (error) {
      console.error('Error in song press handler:', error);
    }
  };

  // Handle direct remove from queue (no menu needed)
  const handleDirectRemove = () => {
    handleRemoveFromQueue();
  };

  // Handle remove from queue
  const handleRemoveFromQueue = async () => {
    try {
      if (typeof onRemoveFromQueue === 'function') {
        await onRemoveFromQueue(index, id);
        ToastAndroid.show('Removed from queue', ToastAndroid.SHORT);
      } else {
        // Fallback: remove using TrackPlayer directly
        const queue = await TrackPlayer.getQueue();
        const trackIndex = queue.findIndex(track => track.id === id);
        if (trackIndex !== -1) {
          await TrackPlayer.remove(trackIndex);
          ToastAndroid.show('Removed from queue', ToastAndroid.SHORT);
        }
      }
    } catch (error) {
      console.error('Error removing from queue:', error);
      ToastAndroid.show('Failed to remove from queue', ToastAndroid.SHORT);
    }
  };


  
  // Theme-aware colors
  const getRippleColor = () => {
    return themeMode === 'light'
      ? 'rgba(0, 0, 0, 0.05)'
      : 'rgba(255, 255, 255, 0.05)';
  };

  const getActiveBackgroundColor = () => {
    // Uniform gray background for all dragged items - consistent like image 2
    return themeMode === 'light'
      ? 'rgba(0, 0, 0, 0.1)' // Consistent gray for all items
      : 'rgba(255, 255, 255, 0.15)'; // Consistent light gray for all items
  };

  const getCurrentTrackBackgroundColor = () => {
    // Use theme's playingColor with proper opacity conversion
    const playingColor = theme.colors.playingColor || theme.colors.primary;
    const opacity = themeMode === 'light' ? 0.08 : 0.12; // Light theme: lower opacity, dark theme: slightly higher
    return getOpacityColor(playingColor, opacity);
  };

  const getShadowColor = () => {
    return themeMode === 'light' ? "#000" : "#000";
  };

  return (
    <Pressable
      onPress={handlePress}
      {...dragHandlers}
      android_ripple={{ color: getRippleColor() }}
      style={{
        flexDirection: 'row',
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginVertical: 2,
        width: SCREEN_WIDTH,
        backgroundColor: isActive
          ? getActiveBackgroundColor()
          : isCurrentTrack
            ? getCurrentTrackBackgroundColor()
            : 'transparent',
        borderRadius: 8,
        // Clean, simple drag styling like reference image
        ...(isActive && {
          elevation: 1, // Minimal elevation
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 1,
          },
          shadowOpacity: 0.1, // Very light shadow
          shadowRadius: 1,
        }),
      }}
    >
      {/* Song image - clean and simple */}
      <FastImage
        source={getImageSource()}
        style={{
          height: 48,
          width: 48,
          borderRadius: 8,
          marginRight: 12,
          opacity: 1, // No opacity change - keep it clean
        }}
      />
      
      {/* Song info */}
      <View style={{ 
        flex: 1,
        width: maxTextWidth,
        justifyContent: 'center',
      }}>
        <PlainText
          text={truncateText(formatText(title), 20)}
          style={{
            width: maxTextWidth,
            fontWeight: isCurrentTrack ? '700' : '600',
            color: isCurrentTrack
              ? (theme.colors.playingColor || theme.colors.primary)
              : theme.colors.text,
            fontSize: 15,
            lineHeight: 20,
          }}
          numberOfLine={1}
        />
        <SmallText
          text={truncateText(formatText(artist), 20)}
          style={{
            width: maxTextWidth,
            opacity: 0.8,
            marginTop: 2,
            fontWeight: '500',
            color: theme.colors.text,
          }}
          maxLine={1}
        />
      </View>
      
      {/* Download button */}
      <View style={{ marginRight: 8 }}>
        <DownloadControl
          isDownloaded={isDownloaded}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          onDownloadPress={startDownload}
          isOffline={false}
          disabled={!canDownload}
          size={20}
          style={{ padding: 6 }}
        />
      </View>

      {/* Trash icon for removing from queue */}
      <Pressable
        onPress={handleDirectRemove}
        {...(typeof drag === 'function' ? dragHandlers : {})}
        style={{
          width: 36,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
          backgroundColor: 'transparent', // Keep trash icon area clean
          borderRadius: 4,
        }}
      >
        <MaterialCommunityIcons
          name="delete-outline"
          size={20}
          color={theme.colors.text}
          style={{ opacity: 0.8 }}
        />
      </Pressable>


    </Pressable>
  );
});
