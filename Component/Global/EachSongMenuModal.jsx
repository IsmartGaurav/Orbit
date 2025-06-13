import Modal from "react-native-modal";
import { Dimensions, PermissionsAndroid, Platform, Pressable, ToastAndroid, View } from "react-native";
import { PlainText } from "./PlainText";
import React, { useContext } from "react";
import { useTheme } from "@react-navigation/native";
import FormatTitleAndArtist from "../../Utils/FormatTitleAndArtist";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import DeviceInfo from "react-native-device-info";
import { AddSongsToQueue, getIndexQuality} from "../../MusicPlayerFunctions";
import { UnifiedDownloadService } from '../../Utils/UnifiedDownloadService';
import Context from "../../Context/Context";
import TrackPlayer from "react-native-track-player";
import { GetCustomPlaylists, AddSongToCustomPlaylist } from "../../LocalStorage/CustomPlaylists";
import { GetLocalMusicFavorites, AddLocalMusicToFavorites, RemoveLocalMusicFromFavorites, IsLocalMusicFavorite } from "../../LocalStorage/StoreLocalMusic";
import { useState } from "react";
import { ScrollView, TextInput } from "react-native";
import { CreateCustomPlaylist } from "../../LocalStorage/CustomPlaylists";
import FastImage from "react-native-fast-image";

const styles = {
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyStateImage: {
    width: 100,
    height: 100,
    opacity: 0.5,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  playlistImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  playlistInfo: {
    marginLeft: 15,
    flex: 1,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '500',
  },
  songCount: {
    color: 'gray',
    fontSize: 12,
    marginTop: 4,
  },
};

// Helper function to safely get the song URL
const getSongUrl = (urlData, quality = 4) => {
  try {
    // Check if urlData is an array with at least quality+1 elements
    if (Array.isArray(urlData) && urlData.length > quality) {
      return urlData[quality].url;
    }
    
    // Check if urlData is an object with a downloadUrl property
    if (urlData && urlData.downloadUrl && Array.isArray(urlData.downloadUrl) && urlData.downloadUrl.length > quality) {
      return urlData.downloadUrl[quality].url;
    }
    
    // Check if urlData is a string directly
    if (typeof urlData === 'string') {
      return urlData;
    }
    
    // Handle local music path
    if (urlData && urlData.path) {
      return urlData.path;
    }
    
    console.log("Unable to extract song URL from:", JSON.stringify(urlData));
    return null;
  } catch (error) {
    console.error("Error getting song URL:", error);
    return null;
  }
};

export const EachSongMenuModal = ({Visible, setVisible}) => {
  const { colors } = useTheme();
  const {updateTrack} = useContext(Context);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [availablePlaylists, setAvailablePlaylists] = useState({});
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Check if the song is a local music file
  const isLocalMusic = Visible.isLocalMusic === true;
  
  // Debug log when modal opens
  React.useEffect(() => {
    if (Visible.visible) {
      console.log("Song menu opened for:", Visible.title);
      if (Visible.url) {
        console.log("URL structure:", typeof Visible.url, Array.isArray(Visible.url) ? `Array[${Visible.url.length}]` : "Not Array");
        
        // More detailed logging of URL structure
        if (Array.isArray(Visible.url)) {
          console.log("URL array first element:", JSON.stringify(Visible.url[0]));
        } else if (typeof Visible.url === 'object') {
          console.log("URL keys:", Object.keys(Visible.url));
          if (Visible.url.downloadUrl) {
            console.log("downloadUrl structure:", Array.isArray(Visible.url.downloadUrl) ? 
              `Array[${Visible.url.downloadUrl.length}]` : typeof Visible.url.downloadUrl);
          }
        }
      }
    }
  }, [Visible.visible, Visible.title, Visible.url]);
  
  // Check if the song is a favorite when the modal opens
  React.useEffect(() => {
    if (Visible.visible && Visible.id) {
      const checkFavoriteStatus = async () => {
        if (isLocalMusic) {
          const isFav = await IsLocalMusicFavorite(Visible.id);
          setIsFavorite(isFav);
        }
      };
      checkFavoriteStatus();
    }
  }, [Visible.visible, Visible.id, isLocalMusic]);
  
  async function actualDownload () {
    try {
      // Prepare song data for unified service
      const songData = {
        id: Visible.id,
        title: Visible.title,
        artist: Visible.artist,
        url: Visible.url,
        image: Visible.image,
        artwork: Visible.image,
        duration: Visible.duration,
        language: Visible.language
      };

      // Use unified download service
      const success = await UnifiedDownloadService.downloadSong(songData);

      if (success) {
        ToastAndroid.showWithGravity(
          "Download successfully completed",
          ToastAndroid.SHORT,
          ToastAndroid.CENTER,
        );
      } else {
        ToastAndroid.showWithGravity(
          "Download failed",
          ToastAndroid.SHORT,
          ToastAndroid.CENTER,
        );
      }

      setVisible({visible: false});
    } catch (error) {
      console.error("Download error:", error);
      ToastAndroid.showWithGravity(
        `Download failed: ${error.message}`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
    }
  }
  
  async function playNext() {
    try {
      let song;
      
      if (isLocalMusic) {
        // Format local music for player
        song = {
          url: Visible.path,
          title: FormatTitleAndArtist(Visible.title),
          artist: FormatTitleAndArtist(Visible.artist),
          artwork: Visible.cover || 'https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png',
          duration: Visible.duration,
          id: Visible.id,
          isLocalMusic: true
        };
      } else {
        // Format online music for player
        const quality = await getIndexQuality();
        
        // Get the song URL safely
        const songUrl = getSongUrl(Visible.url, quality);
        
        if (!songUrl) {
          console.error("Invalid song URL structure:", Visible.url);
          ToastAndroid.showWithGravity(
            `Cannot play: Invalid URL`,
            ToastAndroid.SHORT,
            ToastAndroid.CENTER,
          );
          return;
        }
        
        song = {
          url: songUrl,
          title: FormatTitleAndArtist(Visible.title),
          artist: FormatTitleAndArtist(Visible.artist),
          artwork: Visible.image,
          duration: Visible.duration,
          id: Visible.id,
          language: Visible.language,
          image: Visible.image,
          downloadUrl: Visible.url,
        }
      }
      
      const queue = await TrackPlayer.getQueue();
      const currentIndex = await TrackPlayer.getCurrentTrack();
      
      // If no track is playing, add to beginning and play
      if (currentIndex === null || queue.length === 0) {
        await TrackPlayer.add(song);
        await TrackPlayer.play();
      } else {
        await TrackPlayer.add(song, currentIndex + 1);
      }
      
      updateTrack();
      setVisible({visible: false});
      ToastAndroid.showWithGravity(
        `Song Will Play Next`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
    } catch (error) {
      console.error("Play next error:", error);
      ToastAndroid.showWithGravity(
        `Unable to add song: ${error.message}`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
    }
  }
  
  const getPermission = async () => {
    if (Platform.OS === 'ios') {
      actualDownload();
    } else {
      try {
        let deviceVersion = DeviceInfo.getSystemVersion();
        let granted = PermissionsAndroid.RESULTS.DENIED;
        if (deviceVersion >= 13) {
          granted = PermissionsAndroid.RESULTS.GRANTED;
        } else {
          granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          );
        }
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          actualDownload();
        } else {
          console.log("please grant permission");
          ToastAndroid.showWithGravity(
            "Storage permission required for download",
            ToastAndroid.SHORT,
            ToastAndroid.CENTER,
          );
        }
      } catch (err) {
        console.error("Permission error:", err);
        ToastAndroid.showWithGravity(
          "Error requesting permission",
          ToastAndroid.SHORT,
          ToastAndroid.CENTER,
        );
      }
    }
  };
  
  // Function to handle adding/removing local music from favorites
  async function toggleLocalMusicFavorite() {
    try {
      const isCurrentlyFavorite = await IsLocalMusicFavorite(Visible.id);
      
      if (isCurrentlyFavorite) {
        await RemoveLocalMusicFromFavorites(Visible.id);
        ToastAndroid.showWithGravity(
          "Removed from favorites",
          ToastAndroid.SHORT,
          ToastAndroid.CENTER
        );
      } else {
        const song = {
          id: Visible.id,
          title: Visible.title,
          artist: Visible.artist,
          path: Visible.path,
          duration: Visible.duration,
          cover: Visible.cover || 'https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png',
          isLocalMusic: true
        };
        await AddLocalMusicToFavorites(song);
        ToastAndroid.showWithGravity(
          "Added to favorites",
          ToastAndroid.SHORT,
          ToastAndroid.CENTER
        );
      }
      
      setIsFavorite(!isCurrentlyFavorite);
      setVisible({visible: false});
    } catch (error) {
      console.error("Error toggling favorite status:", error);
      ToastAndroid.showWithGravity(
        "Failed to update favorites",
        ToastAndroid.SHORT,
        ToastAndroid.CENTER
      );
    }
  };
  
  async function addSongToQueue(){
    try {
      let song;
      
      if (isLocalMusic) {
        // Format local music for queue
        song = {
          url: Visible.path,
          title: FormatTitleAndArtist(Visible.title),
          artist: FormatTitleAndArtist(Visible.artist),
          artwork: Visible.cover || 'https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png',
          duration: Visible.duration,
          id: Visible.id,
          isLocalMusic: true
        };
      } else {
        // Format online music for queue
        const quality = await getIndexQuality();
        
        // Get the song URL safely
        const songUrl = getSongUrl(Visible.url, quality);
        
        if (!songUrl) {
          console.error("Invalid song URL structure for queue:", Visible.url);
          ToastAndroid.showWithGravity(
            `Cannot add to queue: Invalid URL`,
            ToastAndroid.SHORT,
            ToastAndroid.CENTER,
          );
          return;
        }
        
        song = {
          url: songUrl,
          title: FormatTitleAndArtist(Visible.title),
          artist: FormatTitleAndArtist(Visible.artist),
          artwork: Visible.image,
          duration: Visible.duration,
          id: Visible.id,
          language: Visible.language,
          image: Visible.image,
          downloadUrl: Visible.url,
        }
      }
      
      await AddSongsToQueue([song]);
      updateTrack();
      setVisible({visible: false});
      ToastAndroid.showWithGravity(
        `Added to Queue`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
    } catch (error) {
      console.error("Add to queue error:", error);
      ToastAndroid.showWithGravity(
        `Error adding to queue: ${error.message}`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
    }
  }
  const size = Dimensions.get("window").height
  // Add this function alongside other functions like playNext, addSongToQueue, etc.
  async function handleAddToPlaylist() {
    const playlists = await GetCustomPlaylists();
    setAvailablePlaylists(playlists);
    setShowPlaylistModal(true);
  }
  async function addSongToSelectedPlaylist(playlistName) {
    try {
      let song;
      
      if (isLocalMusic) {
        // Format local music for playlist
        song = {
          url: Visible.path,
          title: FormatTitleAndArtist(Visible.title),
          artist: FormatTitleAndArtist(Visible.artist),
          artwork: Visible.cover || 'https://htmlcolorcodes.com/assets/images/colors/gray-color-solid-background-1920x1080.png',
          duration: Visible.duration,
          id: Visible.id,
          isLocalMusic: true
        };
      } else {
        // Format online music for playlist
        const quality = await getIndexQuality();
        
        // Get the song URL safely
        const songUrl = getSongUrl(Visible.url, quality);
        
        if (!songUrl) {
          console.error("Invalid song URL structure for playlist:", Visible.url);
          ToastAndroid.showWithGravity(
            `Cannot add to playlist: Invalid URL`,
            ToastAndroid.SHORT,
            ToastAndroid.CENTER,
          );
          return;
        }
        
        song = {
          url: songUrl,
          title: FormatTitleAndArtist(Visible.title),
          artist: FormatTitleAndArtist(Visible.artist),
          artwork: Visible.image,
          duration: Visible.duration,
          id: Visible.id,
          language: Visible.language,
          image: Visible.image,
          downloadUrl: Visible.url,
        };
      }
    
      const playlists = await GetCustomPlaylists();
      const playlist = playlists[playlistName] || [];
      
      if (playlist.some(track => track.id === song.id)) {
        ToastAndroid.showWithGravity(
          "Song already exists in this playlist",
          ToastAndroid.SHORT,
          ToastAndroid.CENTER
        );
        return;
      }

      await AddSongToCustomPlaylist(playlistName, song);
      ToastAndroid.showWithGravity(
        "Song added to " + playlistName,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER
      );
      setShowPlaylistModal(false);
      setVisible({visible: false});
    } catch (error) {
      console.error("Error adding song to playlist:", error);
      ToastAndroid.showWithGravity(
        `Error adding to playlist: ${error.message}`,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER
      );
    }
  }
  async function handleCreatePlaylist() {
    if (newPlaylistName.trim()) {
      await CreateCustomPlaylist(newPlaylistName);
      const playlists = await GetCustomPlaylists();
      setAvailablePlaylists(playlists);
      setNewPlaylistName('');
      ToastAndroid.showWithGravity(
        "Playlist created successfully",
        ToastAndroid.SHORT,
        ToastAndroid.CENTER
      );
    }
  }
  const getPlaylistImage = (playlist) => {
    if (!playlist || playlist.length === 0) {
      return require('../../Images/wav.png');
    }
    return { uri: playlist[playlist.length - 1].image };
  };
  return (
    <>
      <Modal 
        onBackButtonPress={() => setVisible({visible: false})} 
        onBackdropPress={() => setVisible({visible: false})} 
        isVisible={Visible.visible} 
        backdropOpacity={0}
        animationIn="fadeIn"
        animationOut="fadeOut"
        animationInTiming={50}
        animationOutTiming={50}
        useNativeDriver
        hideModalContentWhileAnimating
        style={{
          margin: 0,
          position: 'absolute',
          top: typeof Visible.position?.y === 'number' ? Visible.position.y : 0,
          right: 16,
          justifyContent: 'flex-start',
        }}
      >
        <View style={{
          backgroundColor: colors.card, // Themed background
          borderRadius: 10,
          width: 200,
          overflow: 'hidden',
          elevation: 10,
          transform: [
            { translateY: -50 },
            { scale: Visible.visible ? 1 : 0.95 }
          ],
          opacity: Visible.visible ? 1 : 0,
        }}>
        
          <MenuButton
            icon={<MaterialCommunityIcons name="play-speed" size={22} color={colors.text}/>}
            text="Play Next"
            onPress={playNext}
            textColor={colors.text}
          />
          <MenuButton
            icon={<MaterialCommunityIcons name="playlist-plus" size={22} color={colors.text}/>}
            text="Add to Queue"
            onPress={addSongToQueue}
            textColor={colors.text}
          />
          <MenuButton
            icon={<MaterialCommunityIcons name="playlist-plus" size={22} color={colors.text}/>}
            text="Add to Playlist"
            onPress={handleAddToPlaylist}
          />
          {isLocalMusic ? (
            <MenuButton
              icon={<MaterialCommunityIcons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#ff5252" : colors.text}/>}
              text={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              onPress={toggleLocalMusicFavorite}
            />
          ) : (
            <MenuButton
              icon={<MaterialCommunityIcons name="download" size={22} color={colors.text}/>}
              text="Download"
              onPress={getPermission}
              textColor={colors.text}
            />
          )}
          
        </View>
      </Modal>
      <Modal
        isVisible={showPlaylistModal}
        onBackdropPress={() => setShowPlaylistModal(false)}
        onBackButtonPress={() => setShowPlaylistModal(false)}
        style={{
          margin: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View style={{
          backgroundColor: colors.card, // Themed background
          borderRadius: 10,
          padding: 20,
          width: '80%',
          maxHeight: '70%',
        }}>
          <TextInput
            placeholder="Create new playlist..."
            placeholderTextColor={colors.placeholder || colors.text} // Use placeholder or fallback to text
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 5,
              padding: 12,
              color: colors.text,
              marginBottom: 10,
            }}
          />
          
          <Pressable
            onPress={handleCreatePlaylist}
            style={{
              backgroundColor: '#1DB954',
              padding: 12,
              borderRadius: 5,
              alignItems: 'center',
              marginBottom: 15,
            }}
          >
            <PlainText text="Create New Playlist" style={{ color: 'white' }} />
          </Pressable>
          
          <ScrollView style={{ maxHeight: 300 }}>
            {Object.keys(availablePlaylists).length === 0 ? (
              <View style={{ padding: 10, alignItems: 'center' }}>
                <PlainText 
                  text="No playlists available" 
                  style={{ color: colors.text, textAlign: 'center' }}
                />
              </View>
            ) : (
              Object.keys(availablePlaylists).map((name) => (
                <Pressable
                  key={name}
                  onPress={() => addSongToSelectedPlaylist(name)}
                  android_ripple={{color: colors.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: colors.border, // Themed background for playlist items
                    borderRadius: 5,
                    marginBottom: 8,
                  }}
                >
                  <FastImage
                    source={getPlaylistImage(availablePlaylists[name])}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 4,
                    }}
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <PlainText 
                      text={name} 
                      style={{
                        color: colors.text,
                        fontSize: 16,
                      }}
                    />
                    <PlainText 
                      text={`${availablePlaylists[name].length} songs`} 
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                      }}
                    />
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const MenuButton = ({icon, text, onPress, textColor: textColorProp}) => {
  const theme = useTheme();
  const rippleColor = theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const finalTextColor = textColorProp || theme.colors.text;

  return (
  <Pressable 
    onPress={onPress}
    android_ripple={{color: rippleColor}}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      paddingHorizontal: 16,
    }}
  >
    {icon}
    <PlainText 
      text={text} 
      style={{
        color: finalTextColor,
        marginLeft: 16,
        fontSize: 14,
      }}
    />
  </Pressable>
  );
};
