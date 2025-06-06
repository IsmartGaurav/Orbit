import Animated, { useAnimatedRef } from "react-native-reanimated";
import { LikedPagesTopHeader } from "../../Component/Library/TopHeaderLikedPages";
import { LikedDetails } from "../../Component/Library/LikedDetails";
import { useEffect, useState } from "react";
import { GetLikedSongs } from "../../LocalStorage/StoreLikedSongs";
import { EachSongCard } from "../../Component/Global/EachSongCard";
import { Dimensions, View, BackHandler } from "react-native";
import { useTheme, useNavigation } from "@react-navigation/native";

export const LikedSongPage = () => {
  const AnimatedRef = useAnimatedRef()
  const [LikedSongs, setLikedSongs] = useState([]);
  const width = Dimensions.get("window").width
  const theme = useTheme()
  const navigation = useNavigation();
  
  // Add a direct back button handler to ensure proper navigation
  useEffect(() => {
    const handleBackPress = () => {
      console.log('Back pressed in LikedSongPage, navigating to LibraryPage');
      navigation.navigate('LibraryPage');
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    
    return () => {
      backHandler.remove();
    };
  }, [navigation]);

  async function getAllLikedSongs(){
    const Songs = await GetLikedSongs()
    const Temp = []
    // eslint-disable-next-line no-unused-vars
    for (const [_, value] of Object.entries(Songs.songs)) {
      Temp[value.count] = value
    }
    const Final = []
    Temp?.map((e)=>{
      if (e) {
        Final.push({
          url:e.url,
          title:e?.title,
          artist:e?.artist,
          artwork:e?.image,
          duration:e?.duration,
          id:e?.id,
          language:e?.language,
          artistID:e?.primary_artists_id,
        })
      }
    })
    setLikedSongs(Final)
  }
  useEffect(() => {
    getAllLikedSongs()
  }, []);
  return (
    <Animated.ScrollView scrollEventThrottle={16} ref={AnimatedRef} contentContainerStyle={{
      paddingBottom:55,
      backgroundColor:"rgba(0,0,0)",
    }}>
      <LikedPagesTopHeader AnimatedRef={AnimatedRef} url={require("../../Images/likedMusic.webp")} />
      <LikedDetails name={"Liked Songs"} Data={LikedSongs} textStyle={!theme.dark ? { color: '#FFFFFF' } : {}}/>
     <View style={{paddingHorizontal:10, backgroundColor:theme.colors.background}}>
       {LikedSongs.map((e,i) =>{
         return <EachSongCard width={width * 0.95} Data={LikedSongs} index={i} showNumber={false} url={e?.url} id={e?.id} title={e?.title} artist={e?.artist} image={e?.artwork} language={e?.language} duration={e?.duration} artistID={e?.artistID} key={i}/>
       })}
     </View>
    </Animated.ScrollView>
  );
};
