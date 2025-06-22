import { useState, useCallback, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ToastAndroid } from 'react-native';
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "@react-navigation/native";
import { AddOneSongToPlaylist } from '../../../MusicPlayerFunctions';
import { getArtistSongs, getAlbumSongs, getSearchSongData, getSearchArtistData } from '../../../Api/Songs';
import { debugCurrentPlaying, debugMenuAction, validateSongForPlaylist, validateNavigationData } from './MenuDebugHelper';
import navigationBreadcrumbs from '../../../Utils/NavigationBreadcrumbs';
import { runComprehensiveTest, validateSongForTesting, debugSongStructure } from './TestMenuFunctions';

/**
 * useFullScreenMusicMenu - Custom hook for managing FullScreen music menu functionality
 * Provides menu options, handlers, and state management for the three-dot menu
 * 
 * @param {Object} currentPlaying - Current playing track object
 * @param {boolean} isOffline - Whether the app is in offline mode
 * @returns {Object} Menu state and handlers
 */
export const useFullScreenMusicMenu = (currentPlaying, isOffline) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 100, right: 16 });
  const navigation = useNavigation();
  const theme = useTheme();
  const { colors } = theme;

  // Debug current playing track when it changes
  useEffect(() => {
    if (currentPlaying) {
      debugCurrentPlaying(currentPlaying);
    }
  }, [currentPlaying]);

  // Helper function to extract multiple artists from song data
  const extractMultipleArtists = useCallback((song) => {
    if (!song) return [];

    const artists = [];

    // Method 1: Check artists.primary array (most common for multiple artists)
    if (song.artists?.primary && Array.isArray(song.artists.primary)) {
      song.artists.primary.forEach(artist => {
        if (artist && artist.name && artist.id) {
          artists.push({
            id: artist.id,
            name: artist.name.trim(),
            type: 'primary'
          });
        }
      });
    }

    // Method 2: If no artists.primary, try to parse from artist string
    if (artists.length === 0 && song.artist) {
      // Split by common separators for multiple artists
      const artistNames = song.artist.split(/[,&]|feat\.?|ft\.?/i)
        .map(name => name.trim())
        .filter(name => name.length > 0);

      artistNames.forEach((name, index) => {
        // Try to get ID from various fields for the first artist
        let artistId = null;
        if (index === 0) {
          artistId = song.artistID ||
                    song.primary_artists_id ||
                    song.more_info?.artistid ||
                    song.more_info?.primary_artists_id;
        }

        artists.push({
          id: artistId,
          name: name,
          type: index === 0 ? 'primary' : 'featured'
        });
      });
    }

    // Method 3: Fallback to single artist
    if (artists.length === 0 && song.artist) {
      const artistId = song.artistID ||
                      song.primary_artists_id ||
                      song.more_info?.artistid ||
                      song.more_info?.primary_artists_id;

      artists.push({
        id: artistId,
        name: song.artist.trim(),
        type: 'primary'
      });
    }

    console.log('🎤 Extracted artists:', artists);
    return artists;
  }, []);

  // Helper function to search for artist ID when missing with multiple strategies
  const findArtistId = useCallback(async (artistName) => {
    if (!artistName || isOffline) return null;

    try {
      console.log('🔍 Searching for artist ID with multiple strategies:', artistName);

      // Strategy 1: Direct artist search
      let response = await getSearchArtistData(artistName, 1, 10);

      if (response?.success && response?.data?.results && response.data.results.length > 0) {
        // Find the best match by name similarity
        let bestMatch = response.data.results[0];

        // Look for exact or close match
        const exactMatch = response.data.results.find(artist =>
          artist.name.toLowerCase() === artistName.toLowerCase()
        );

        if (exactMatch) {
          bestMatch = exactMatch;
          console.log('✅ Found exact artist match:', bestMatch.name, 'ID:', bestMatch.id);
        } else {
          // Look for partial match
          const partialMatch = response.data.results.find(artist =>
            artist.name.toLowerCase().includes(artistName.toLowerCase()) ||
            artistName.toLowerCase().includes(artist.name.toLowerCase())
          );

          if (partialMatch) {
            bestMatch = partialMatch;
            console.log('✅ Found partial artist match:', bestMatch.name, 'ID:', bestMatch.id);
          } else {
            console.log('✅ Using first result:', bestMatch.name, 'ID:', bestMatch.id);
          }
        }

        return bestMatch.id;
      }

      // Strategy 2: If artist search fails, try searching songs by this artist
      console.log('🔍 Artist search failed, trying song search as backup...');
      const songResponse = await getSearchSongData(artistName, 1, 10);

      if (songResponse?.success && songResponse?.data?.results && songResponse.data.results.length > 0) {
        // Look for songs by this artist and extract artist ID
        for (const song of songResponse.data.results) {
          const songArtist = song.artist || song.artists?.primary?.[0]?.name || '';
          if (songArtist.toLowerCase().includes(artistName.toLowerCase()) ||
              artistName.toLowerCase().includes(songArtist.toLowerCase())) {

            const artistId = song.artists?.primary?.[0]?.id ||
                           song.artistID ||
                           song.primary_artists_id;

            if (artistId) {
              console.log('✅ Found artist ID via song search:', artistId, 'from song:', song.name);
              return artistId;
            }
          }
        }
      }

      console.log('❌ All artist search strategies failed');
    } catch (error) {
      console.error('❌ Error searching for artist:', error);
    }

    return null;
  }, [isOffline]);

  // Helper function to search for song details when missing album info
  const findSongDetails = useCallback(async (songTitle, artistName) => {
    if (!songTitle || isOffline) return null;

    try {
      console.log('🔍 Searching for song details:', songTitle, 'by', artistName);
      const searchQuery = artistName ? `${songTitle} ${artistName}` : songTitle;
      const response = await getSearchSongData(searchQuery, 1, 10); // Increased limit for better results

      if (response?.success && response?.data?.results && response.data.results.length > 0) {
        // Try to find the best match by comparing titles
        let bestMatch = response.data.results[0];

        if (artistName && response.data.results.length > 1) {
          // Look for a better match that includes the artist name
          const betterMatch = response.data.results.find(song => {
            const songArtist = song.artist || song.artists?.primary?.[0]?.name || '';
            return songArtist.toLowerCase().includes(artistName.toLowerCase()) ||
                   artistName.toLowerCase().includes(songArtist.toLowerCase());
          });

          if (betterMatch) {
            bestMatch = betterMatch;
            console.log('✅ Found better artist match:', betterMatch.name);
          }
        }

        console.log('✅ Found song details:', bestMatch.name, 'Album:', bestMatch.album?.name);

        // Extract album information from multiple possible fields
        const albumId = bestMatch.album?.id ||
                       bestMatch.albumId ||
                       bestMatch.album_id ||
                       bestMatch.more_info?.album_id;

        const albumName = bestMatch.album?.name ||
                         bestMatch.album ||
                         bestMatch.more_info?.album;

        return {
          albumId: albumId,
          albumName: albumName,
          artistId: bestMatch.artists?.primary?.[0]?.id || bestMatch.artistID || bestMatch.primary_artists_id
        };
      }
    } catch (error) {
      console.error('❌ Error searching for song details:', error);
    }

    return null;
  }, [isOffline]);

  // Show menu with position calculation
  const showMenu = useCallback(() => {
    // Set position for the menu (top-right area of screen)
    setMenuPosition({ top: 100, right: 16 });
    setMenuVisible(true);
  }, []);

  // Close menu
  const closeMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  // Navigate to specific artist by ID and name
  const navigateToSpecificArtist = useCallback(async (artistId, artistName) => {
    debugMenuAction('Navigate to Specific Artist', { artistId, artistName });

    if (!artistName) {
      ToastAndroid.show('Artist name not available', ToastAndroid.SHORT);
      return;
    }

    let finalArtistId = artistId;

    // If no artist ID, try to find it by searching
    if (!finalArtistId) {
      console.log('🔍 Artist ID missing, searching for:', artistName);
      ToastAndroid.show('Searching for artist...', ToastAndroid.SHORT);

      finalArtistId = await findArtistId(artistName);

      if (!finalArtistId) {
        ToastAndroid.show('Could not find artist information', ToastAndroid.SHORT);
        return;
      }
    }

    // Validate artist ID format
    if (typeof finalArtistId !== 'string' && typeof finalArtistId !== 'number') {
      console.log('❌ Invalid artist ID format:', typeof finalArtistId, finalArtistId);
      ToastAndroid.show('Invalid artist information', ToastAndroid.SHORT);
      return;
    }

    try {
      console.log('🧭 Navigating to specific artist:', { artistId: finalArtistId, artistName });

      // Add FullScreenMusic to breadcrumbs before navigating
      navigationBreadcrumbs.addBreadcrumb({
        screenName: 'FullScreenMusic',
        displayName: currentPlaying?.title || 'Now Playing',
        params: { currentPlaying },
        source: 'music_player'
      });

      navigation.navigate("MainRoute", {
        screen: 'Home',
        params: {
          screen: 'ArtistPage',
          params: {
            artistId: String(finalArtistId),
            artistName: artistName,
            source: 'FullScreenMusic'
          }
        }
      });
      ToastAndroid.show(`Opening ${artistName} page`, ToastAndroid.SHORT);
    } catch (error) {
      console.error('❌ Error navigating to specific artist:', error);
      ToastAndroid.show('Failed to open artist page', ToastAndroid.SHORT);
    }
  }, [currentPlaying, navigation, findArtistId]);

  // Navigate to Artist screen (legacy function for single artist)
  const navigateToArtist = useCallback(async () => {
    debugMenuAction('Navigate to Artist', currentPlaying);

    if (!currentPlaying) {
      ToastAndroid.show('No song is currently playing', ToastAndroid.SHORT);
      return;
    }

    // Get the first/primary artist
    const artists = extractMultipleArtists(currentPlaying);
    if (artists.length === 0) {
      ToastAndroid.show('No artist information available', ToastAndroid.SHORT);
      return;
    }

    const primaryArtist = artists[0];
    await navigateToSpecificArtist(primaryArtist.id, primaryArtist.name);
  }, [currentPlaying, extractMultipleArtists, navigateToSpecificArtist]);

  // Navigate to Album screen
  const navigateToAlbum = useCallback(async () => {
    debugMenuAction('Navigate to Album', currentPlaying);

    if (!currentPlaying) {
      ToastAndroid.show('No song is currently playing', ToastAndroid.SHORT);
      return;
    }

    // Enhanced album ID detection with more comprehensive field checking
    let albumId = currentPlaying.albumId ||
                  currentPlaying.album_id ||
                  currentPlaying.album?.id ||
                  currentPlaying.more_info?.album_id ||
                  currentPlaying.more_info?.albumid;

    let albumName = currentPlaying.album?.name ||
                    currentPlaying.album ||
                    currentPlaying.more_info?.album ||
                    'Unknown Album';

    console.log('🔍 Album detection attempt:', {
      albumId,
      albumName,
      availableFields: {
        albumId: currentPlaying.albumId,
        album_id: currentPlaying.album_id,
        'album.id': currentPlaying.album?.id,
        'album.name': currentPlaying.album?.name,
        album: currentPlaying.album,
        'more_info.album_id': currentPlaying.more_info?.album_id,
        'more_info.albumid': currentPlaying.more_info?.albumid,
        'more_info.album': currentPlaying.more_info?.album
      }
    });

    // If no album ID, try multiple search strategies
    if (!albumId && currentPlaying.title) {
      console.log('🔍 Album ID missing, trying search strategies for:', currentPlaying.title);
      ToastAndroid.show('Searching for album...', ToastAndroid.SHORT);

      // Strategy 1: Search by song title and artist
      let songDetails = await findSongDetails(currentPlaying.title, currentPlaying.artist);

      // Strategy 2: If first search fails, try with just song title
      if (!songDetails?.albumId && currentPlaying.title) {
        console.log('🔍 Trying search with just song title...');
        songDetails = await findSongDetails(currentPlaying.title, null);
      }

      // Strategy 3: Try alternative search with different query format
      if (!songDetails?.albumId && currentPlaying.artist) {
        console.log('🔍 Trying alternative search format...');
        const alternativeQuery = `"${currentPlaying.title}" "${currentPlaying.artist}"`;
        songDetails = await findSongDetails(alternativeQuery, null);
      }

      if (songDetails?.albumId) {
        albumId = songDetails.albumId;
        albumName = songDetails.albumName || albumName;
        console.log('✅ Found album via search:', albumName, 'ID:', albumId);
      }
    }

    if (!albumId) {
      console.log('❌ No album ID found after all attempts');
      ToastAndroid.show('Album information not available for this song', ToastAndroid.SHORT);
      return;
    }

    // Validate album ID format
    if (typeof albumId !== 'string' && typeof albumId !== 'number') {
      console.log('❌ Invalid album ID format:', typeof albumId, albumId);
      ToastAndroid.show('Invalid album information', ToastAndroid.SHORT);
      return;
    }

    try {
      console.log('🧭 Navigating to album:', { albumId, albumName });

      // Add FullScreenMusic to breadcrumbs before navigating
      navigationBreadcrumbs.addBreadcrumb({
        screenName: 'FullScreenMusic',
        displayName: currentPlaying?.title || 'Now Playing',
        params: { currentPlaying },
        source: 'music_player'
      });

      navigation.navigate("Album", {
        id: String(albumId), // Ensure ID is string for consistency
        name: albumName,
        source: 'FullScreenMusic'
      });
      ToastAndroid.show(`Opening ${albumName} album`, ToastAndroid.SHORT);
    } catch (error) {
      console.error('❌ Error navigating to album:', error);
      ToastAndroid.show('Failed to open album page', ToastAndroid.SHORT);
    }
  }, [currentPlaying, navigation, findSongDetails]);

  // Add to playlist functionality
  const addToPlaylist = useCallback(async () => {
    console.log('🎵 FullScreenMusic addToPlaylist called');
    debugMenuAction('Add to Playlist', currentPlaying);

    if (!currentPlaying) {
      console.log('❌ No song is currently playing');
      ToastAndroid.show('No song is currently playing', ToastAndroid.SHORT);
      return;
    }

    console.log('🎵 Current playing song:', currentPlaying.title);

    const validation = validateSongForPlaylist(currentPlaying);
    if (!validation.valid) {
      console.log('❌ Song validation failed:', validation);
      ToastAndroid.show('Song data incomplete for playlist', ToastAndroid.SHORT);
      return;
    }

    try {
      console.log('🎵 Calling AddOneSongToPlaylist from FullScreenMusic...');
      const result = await AddOneSongToPlaylist(currentPlaying);
      console.log('📱 AddOneSongToPlaylist result from FullScreenMusic:', result);
      if (result) {
        console.log('✅ Successfully added to playlist from FullScreenMusic');
      } else {
        console.log('❌ AddOneSongToPlaylist returned false from FullScreenMusic');
      }
    } catch (error) {
      console.error('❌ Error adding to playlist from FullScreenMusic:', error);
      ToastAndroid.show('Failed to add to playlist', ToastAndroid.SHORT);
    }
  }, [currentPlaying]);



  // Add more songs from specific artist
  const addMoreFromSpecificArtist = useCallback(async (artistId, artistName) => {
    debugMenuAction('More from Specific Artist', { artistId, artistName });

    if (isOffline) {
      ToastAndroid.show('This feature is not available offline', ToastAndroid.SHORT);
      return;
    }

    if (!artistName) {
      ToastAndroid.show('Artist name not available', ToastAndroid.SHORT);
      return;
    }

    let finalArtistId = artistId;

    // If no artist ID, try to find it by searching
    if (!finalArtistId) {
      console.log('🔍 Artist ID missing for more songs, searching for:', artistName);
      ToastAndroid.show('Searching for artist...', ToastAndroid.SHORT);

      finalArtistId = await findArtistId(artistName);

      if (!finalArtistId) {
        ToastAndroid.show('Could not find artist information', ToastAndroid.SHORT);
        return;
      }
    }

    try {
      ToastAndroid.show(`Loading more songs from ${artistName}...`, ToastAndroid.SHORT);

      // Try multiple API strategies to get artist songs
      let response = null;
      let songs = [];

      // Strategy 1: Use getArtistSongs API
      try {
        response = await getArtistSongs(String(finalArtistId));
        if (response?.success && response?.data?.songs && response.data.songs.length > 0) {
          songs = response.data.songs;
          console.log(`✅ Found ${songs.length} songs via getArtistSongs`);
        }
      } catch (error) {
        console.log('❌ getArtistSongs failed:', error.message);
      }

      // Strategy 2: If first API fails, try paginated artist songs
      if (songs.length === 0) {
        try {
          const { getArtistSongsPaginated } = require('../../../Api/Songs');
          response = await getArtistSongsPaginated(String(finalArtistId), 1, 20);
          if (response?.success && response?.data?.songs && response.data.songs.length > 0) {
            songs = response.data.songs;
            console.log(`✅ Found ${songs.length} songs via getArtistSongsPaginated`);
          }
        } catch (error) {
          console.log('❌ getArtistSongsPaginated failed:', error.message);
        }
      }

      // Strategy 3: If both APIs fail, search for songs by artist name
      if (songs.length === 0) {
        try {
          console.log('🔍 Trying song search as fallback for artist songs...');
          const searchResponse = await getSearchSongData(artistName, 1, 20);
          if (searchResponse?.success && searchResponse?.data?.results && searchResponse.data.results.length > 0) {
            // Filter songs that actually match the artist
            songs = searchResponse.data.results.filter(song => {
              const songArtist = song.artist || song.artists?.primary?.[0]?.name || '';
              return songArtist.toLowerCase().includes(artistName.toLowerCase()) ||
                     artistName.toLowerCase().includes(songArtist.toLowerCase());
            });
            console.log(`✅ Found ${songs.length} songs via search fallback`);
          }
        } catch (error) {
          console.log('❌ Search fallback failed:', error.message);
        }
      }

      if (songs.length > 0) {
        console.log(`✅ Total songs found: ${songs.length} from artist:`, songs.slice(0, 5).map(s => s.name || s.title));

        // Add FullScreenMusic to breadcrumbs before navigating
        navigationBreadcrumbs.addBreadcrumb({
          screenName: 'FullScreenMusic',
          displayName: currentPlaying?.title || 'Now Playing',
          params: { currentPlaying },
          source: 'music_player'
        });

        // Navigate to artist page to show all songs
        navigation.navigate("MainRoute", {
          screen: 'Home',
          params: {
            screen: 'ArtistPage',
            params: {
              artistId: String(finalArtistId),
              artistName: artistName,
              source: 'FullScreenMusic'
            }
          }
        });

        ToastAndroid.show(`Found ${songs.length} songs from ${artistName}`, ToastAndroid.SHORT);
      } else {
        console.log('❌ No songs found after all strategies');
        ToastAndroid.show(`No additional songs found from ${artistName}`, ToastAndroid.SHORT);
      }
    } catch (error) {
      console.error('❌ Error in addMoreFromSpecificArtist:', error);
      ToastAndroid.show('Failed to load artist songs', ToastAndroid.SHORT);
    }
  }, [isOffline, navigation, findArtistId]);

  // Add more songs from same artist (legacy function for single artist)
  const addMoreFromArtist = useCallback(async () => {
    debugMenuAction('More from Artist', currentPlaying);

    if (!currentPlaying) {
      ToastAndroid.show('No song is currently playing', ToastAndroid.SHORT);
      return;
    }

    // Get the first/primary artist
    const artists = extractMultipleArtists(currentPlaying);
    if (artists.length === 0) {
      ToastAndroid.show('No artist information available', ToastAndroid.SHORT);
      return;
    }

    const primaryArtist = artists[0];
    await addMoreFromSpecificArtist(primaryArtist.id, primaryArtist.name);
  }, [currentPlaying, extractMultipleArtists, addMoreFromSpecificArtist]);

  // Test all menu functions (for debugging)
  const testAllFunctions = useCallback(() => {
    debugMenuAction('Test All Functions', currentPlaying);

    if (!currentPlaying) {
      ToastAndroid.show('No song is currently playing', ToastAndroid.SHORT);
      return;
    }

    // Validate song structure
    const validation = validateSongForTesting(currentPlaying);
    debugSongStructure(currentPlaying);

    // Run comprehensive test
    const menuFunctions = {
      navigateToArtist,
      navigateToAlbum,
      addToPlaylist,
      addMoreFromArtist
    };

    runComprehensiveTest(menuFunctions, currentPlaying);
  }, [currentPlaying, navigateToArtist, navigateToAlbum, addToPlaylist, addMoreFromArtist]);

  // Generate menu options with multiple artist support
  const getMenuOptions = useCallback(() => {
    const baseOptions = [];

    // Always add album option first
    baseOptions.push({
      id: 'album',
      icon: <MaterialCommunityIcons name="album" size={22} color={colors.text} />,
      text: 'Go to Album',
      onPress: navigateToAlbum,
    });

    // Get multiple artists from current song
    const artists = currentPlaying ? extractMultipleArtists(currentPlaying) : [];

    if (artists.length === 0) {
      // No artists found, add generic options
      baseOptions.push({
        id: 'artist',
        icon: <MaterialCommunityIcons name="account-music" size={22} color={colors.text} />,
        text: 'Go to Artist',
        onPress: navigateToArtist,
      });
    } else if (artists.length === 1) {
      // Single artist, add normal options
      const artist = artists[0];
      baseOptions.push({
        id: 'artist',
        icon: <MaterialCommunityIcons name="account-music" size={22} color={colors.text} />,
        text: 'Go to Artist',
        onPress: navigateToArtist,
      });
      baseOptions.push({
        id: 'more-artist',
        icon: <MaterialCommunityIcons name="music-note-plus" size={22} color={colors.text} />,
        text: `More from ${artist.name}`,
        onPress: addMoreFromArtist,
      });
    } else {
      // Multiple artists, add individual options for each
      artists.forEach((artist, index) => {
        // Add "More from [Artist Name]" for each artist
        baseOptions.push({
          id: `more-artist-${index}`,
          icon: <MaterialCommunityIcons name="account-music" size={22} color={colors.text} />,
          text: `More from ${artist.name}`,
          onPress: () => addMoreFromSpecificArtist(artist.id, artist.name),
        });
      });
    }

    // Always add playlist option
    baseOptions.push({
      id: 'playlist',
      icon: <MaterialCommunityIcons name="playlist-plus" size={22} color={colors.text} />,
      text: 'Add to Playlist',
      onPress: addToPlaylist,
    });

    // Add test option in development mode
    if (__DEV__) {
      baseOptions.push({
        id: 'test-all',
        icon: <MaterialCommunityIcons name="bug" size={22} color={colors.text} />,
        text: 'Test All Functions',
        onPress: testAllFunctions,
      });
    }

    return baseOptions;
  }, [
    colors.text,
    currentPlaying,
    extractMultipleArtists,
    navigateToArtist,
    navigateToAlbum,
    addToPlaylist,
    addMoreFromArtist,
    addMoreFromSpecificArtist,
    testAllFunctions
  ]);

  return {
    menuVisible,
    menuPosition,
    showMenu,
    closeMenu,
    getMenuOptions,
  };
};
