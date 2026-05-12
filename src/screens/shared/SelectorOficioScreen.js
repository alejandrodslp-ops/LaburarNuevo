import React,{useState} from 'react';
import{View,Text,StyleSheet,TouchableOpacity,TextInput,FlatList,SafeAreaView}from 'react-native';

const TODOS_OFICIOS=[
  "Niñera","Cuidador/a de ancianos","Cuidador/a de discapacitados",
  "Limpieza del hogar","Limpieza comercial","Mucama","Planchado",
  "Plomero/a","Gasista","Electricista","Pintor/a","Carpintero/a",
  "Albañil","Peon de albanileria","Herrero/a","Soldador/a","Techista",
  "Cerrajero/a","Tapicero/a","Mecanico/a","Jardinero/a",
  "Cortador/a de cesped","Fumigador/a","Tractorista","Peon rural",
  "Cocinero/a","Repostero/a","Mozo/a","Barman","Reponedor/a",
  "Chofer particular","Remisero/a","Camionero/a","Delivery",
  "Portero/a","Sereno/a","Guardia de seguridad","Custodia personal",
  "Costurero/a","Sastre","Zapatero/a","Peluquero/a","Esteticista",
  "Cuidado de animales","Paseador/a de perros","Mudanzas","Mandados",
  "Medico/a","Enfermero/a","Farmaceutico/a","Odontologo/a",
  "Nutricionista","Fisioterapeuta","Psicologo/a","Veterinario/a",
  "Abogado/a","Escribano/a","Contador/a","Economista",
  "Administrador/a","Auditor/a","Ingeniero/a","Arquitecto/a",
  "Diseñador/a","Programador/a","Desarrollador/a Web","Data Analyst",
  "Fotografo/a","Periodista","Marketing Digital","Community Manager",
  "Docente primaria","Docente secundaria","Profesor/a universitario",
  "Educador/a especial","Agronomo/a","Biologo/a","Quimico/a",
  "Asistente Social","Musico/a","Artista plastico","Otro"
];

export default function SelectorOficioScreen({navigation,route}){
  const[busqueda,setBusqueda]=useState("");
  const onSelect=route?.params?.onSelect;
  const opcionesCustom=route?.params?.opciones;
  const tituloCustom=route?.params?.titulo||"Seleccionar oficio";
  const placeholderCustom=route?.params?.placeholder||"Buscar oficio o profesion...";

  const lista=opcionesCustom||TODOS_OFICIOS;
  const filtrados=busqueda.length>0
    ?lista.filter(o=>o.toLowerCase().includes(busqueda.toLowerCase()))
    :lista;

  function seleccionar(oficio){
    if(onSelect)onSelect(oficio);
    navigation.goBack();
  }

  return(
    <SafeAreaView style={ss.c}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Text style={ss.cancelar}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={ss.titulo}>{tituloCustom}</Text>
        <View style={{width:70}}/>
      </View>
      <View style={ss.searchBox}>
        <Text style={{fontSize:16,marginRight:8}}>🔍</Text>
        <TextInput
          style={ss.searchInput}
          placeholder={placeholderCustom}
          placeholderTextColor="#A898B8"
          value={busqueda}
          onChangeText={setBusqueda}
          autoFocus
          autoCorrect={false}
        />
        {busqueda.length>0&&(
          <TouchableOpacity onPress={()=>setBusqueda("")}>
            <Text style={{fontSize:16,color:"#A898B8"}}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filtrados}
        keyExtractor={item=>item}
        renderItem={({item})=>(
          <TouchableOpacity style={ss.item} onPress={()=>seleccionar(item)}>
            <Text style={ss.itemTxt}>{item}</Text>
            <Text style={ss.itemFlecha}>›</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={()=><View style={ss.sep}/>}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#FBF8F4"},
  hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:"#FFFFFF",borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  cancelar:{fontSize:14,fontWeight:"700",color:"#2DD4BF"},
  titulo:{fontSize:16,fontWeight:"800",color:"#1A1020"},
  searchBox:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF",margin:12,borderRadius:12,paddingHorizontal:14,paddingVertical:10,borderWidth:1.5,borderColor:"#EDE8E2"},
  searchInput:{flex:1,fontSize:14,color:"#1A1020"},
  item:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:"#FFFFFF"},
  itemTxt:{fontSize:15,color:"#1A1020"},
  itemFlecha:{fontSize:20,color:"#A898B8"},
  sep:{height:1,backgroundColor:"#EDE8E2",marginLeft:16},
});
