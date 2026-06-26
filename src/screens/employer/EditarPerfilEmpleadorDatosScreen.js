import React,{useState,useEffect} from 'react';
import {logError} from '../../services/logError';
import{View,Text,StyleSheet,TouchableOpacity,TextInput,Alert}from 'react-native';
import{KeyboardAwareScrollView}from 'react-native-keyboard-aware-scroll-view';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import{supabase}from '../../services/supabase';
import{useApp}from '../../services/AppContext';

const PAISES=["Uruguay","Argentina","Brasil","Chile","Paraguay","Bolivia","Peru","Colombia","Mexico","Ecuador","Venezuela","Cuba","Costa Rica","Panama","Guatemala","El Salvador","Honduras","Nicaragua","Republica Dominicana","Spain","Portugal","France","Italy","Germany","United Kingdom","United States","Canada","Australia","Sweden","Norway","Japan","India","Otro"];


function Field({label,value,onChange,placeholder,keyboard,optional}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
      <TextInput style={ss.fi} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#A898B8" keyboardType={keyboard||"default"}/>
    </View>
  );
}

function SearchField({label,value,onChange,placeholder,suggestions,onSelect,optional}){
  const[show,setShow]=useState(false);
  const filtered=value.length>0?suggestions.filter(s=>s.toLowerCase().includes(value.toLowerCase())):suggestions.slice(0,8);
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
      <TextInput style={ss.fi} value={value} onChangeText={t=>{onChange(t);setShow(true);}} placeholder={placeholder} placeholderTextColor="#A898B8" onFocus={()=>setShow(true)}/>
      {show&&filtered.length>0&&(
        <View style={ss.sugg}>
          {filtered.slice(0,6).map(s=>(<TouchableOpacity key={s} style={ss.suggI} onPress={()=>{onSelect(s);setShow(false);}}><Text style={ss.suggT}>{s}</Text></TouchableOpacity>))}
        </View>
      )}
    </View>
  );
}

export default function EditarPerfilEmpleadorDatosScreen({navigation}){
  const{marcarEmpleadorDatosCompletos}=useApp();
  const[nombre,setNombre]=useState('');
  const[nombre2,setNombre2]=useState('');
  const[apellido1,setApellido1]=useState('');
  const[apellido2,setApellido2]=useState('');
  const[pais,setPais]=useState('');
  const[ciudad,setCiudad]=useState('');
  const[barrio,setBarrio]=useState('');
  const[direccion,setDireccion]=useState('');
  const[telefono,setTelefono]=useState('');
  const[saving,setSaving]=useState(false);

  const[ciudadesDisp,setCiudadesDisp]=useState([]);
  const[barriosDisp,setBarriosDisp]=useState([]);

  useEffect(()=>{
    if(!pais)return;
    setCiudad('');
    const mapaIngles={'Uruguay':'Uruguay','Argentina':'Argentina','Brasil':'Brazil','Chile':'Chile','Paraguay':'Paraguay','Bolivia':'Bolivia','Peru':'Peru','Colombia':'Colombia','Mexico':'Mexico','Ecuador':'Ecuador','Venezuela':'Venezuela','Spain':'Spain','United States':'United States','France':'France','Germany':'Germany','Italy':'Italy','Portugal':'Portugal'};
    const paisIngles=mapaIngles[pais]||pais;
    fetch('https://countriesnow.space/api/v0.1/countries/cities',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({country:paisIngles})
    })
    .then(r=>r.json())
    .then(d=>{if(d.data)setCiudadesDisp(d.data);})
    .catch(()=>setCiudadesDisp([]));
  },[pais]);

  useEffect(()=>{
    if(!ciudad||!pais)return;
    setBarriosDisp([]);
    const mapaBarrios={"Brasil":"Brazil","México":"Mexico","Perú":"Peru","Panamá":"Panama","Argentina":"Argentina","Uruguay":"Uruguay","Chile":"Chile","Colombia":"Colombia","Bolivia":"Bolivia","Paraguay":"Paraguay","Ecuador":"Ecuador","Venezuela":"Venezuela"};const paisNom=mapaBarrios[pais]||pais;
    fetch(`https://nominatim.openstreetmap.org/search?q=neighbourhood+${encodeURIComponent(ciudad)}+${encodeURIComponent(paisNom)}&format=json&limit=30&addressdetails=1`,{
      headers:{'Accept-Language':'es','User-Agent':'KonexuApp/1.0'}
    })
    .then(r=>r.json())
    .then(data=>{
      const nombres=[...new Set(data.map(d=>{
        const a=d.address;
        return a.neighbourhood||a.suburb||a.quarter||a.city_district||'';
      }).filter(Boolean))];
      setBarriosDisp(nombres);
    })
    .catch(()=>setBarriosDisp([]));
  },[ciudad, pais]);


  useEffect(()=>{
    async function detectarPais(){
      try{
        if(!pais){
          const res=await fetch('https://ipapi.co/json/');
          const data=await res.json();
          if(data.country_name){
            const nombrePais=data.country_name;
            // Mapear nombre en ingles a nuestros nombres
            const mapa={'Uruguay':'Uruguay','Argentina':'Argentina','Brazil':'Brasil','Chile':'Chile','Paraguay':'Paraguay','Bolivia':'Bolivia','Peru':'Peru','Colombia':'Colombia','Mexico':'Mexico','Ecuador':'Ecuador','Venezuela':'Venezuela','Cuba':'Cuba','Costa Rica':'Costa Rica','Panama':'Panama','Guatemala':'Guatemala','El Salvador':'El Salvador','Honduras':'Honduras','Nicaragua':'Nicaragua','Dominican Republic':'Republica Dominicana','Spain':'Spain','Portugal':'Portugal','France':'France','Italy':'Italy','Germany':'Germany','United Kingdom':'United Kingdom','United States':'United States','Canada':'Canada','Australia':'Australia','Sweden':'Sweden','Norway':'Norway','Japan':'Japan','India':'India'};
            const paisMapeado=mapa[nombrePais]||nombrePais;
            if(PAISES.includes(paisMapeado))setPais(paisMapeado);
          }
        }
      }catch(e){}
    }
    detectarPais();
  },[]);

  useEffect(()=>{
    async function cargar(){
      try{
        const{data:{user}}=await supabase.auth.getUser();
        if(!user)return;
        const{data}=await supabase.from('profiles').select('*').eq('id',user.id).single();
        if(data){
          if(data.nombre)setNombre(data.nombre);
          if(data.nombre2)setNombre2(data.nombre2);
          if(data.apellido1)setApellido1(data.apellido1);
          if(data.apellido2)setApellido2(data.apellido2);
          if(data.pais)setPais(data.pais);
          if(data.ciudad)setCiudad(data.ciudad);
          if(data.barrio)setBarrio(data.barrio);
          if(data.direccion)setDireccion(data.direccion);
          if(data.telefono)setTelefono(data.telefono);
        }
      }catch(e){logError('EditarPerfilEmpleadorDatos',e);}
    }
    cargar();
  },[]);

  async function guardar(){
    if(nombre.trim().length<1){Alert.alert('Campos incompletos','El nombre es obligatorio');return;}
    if(apellido1.trim().length<1){Alert.alert('Campos incompletos','El apellido es obligatorio');return;}
    if(!pais){Alert.alert('Campos incompletos','El pais es obligatorio');return;}
    if(!ciudad){Alert.alert('Campos incompletos','La ciudad es obligatoria');return;}
    if(!direccion){Alert.alert('Campos incompletos','La direccion es obligatoria');return;}
    setSaving(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){navigation.navigate('Login');return;}
      const{error}=await supabase.from('profiles').upsert({
        id:user.id,
        nombre,nombre2,apellido1,apellido2,telefono,
        pais,ciudad,barrio,direccion,
        rol:'employer',
        modo_activo:'employer',
        updated_at:new Date().toISOString(),
      });
      if(error)throw error;
      marcarEmpleadorDatosCompletos();
      Alert.alert('Perfil actualizado','Tus datos fueron guardados.',[{text:'OK',onPress:()=>navigation.goBack()}]);
    }catch(e){Alert.alert('Error',e.message||'No se pudo guardar');}
    finally{setSaving(false);}
  }

  return(
    <SafeAreaView style={ss.c} edges={['top']}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>Volver</Text></TouchableOpacity>
        <Text style={ss.htit}>Mis datos</Text>
        <View style={{width:50}}/>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={{paddingBottom:48}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" enableOnAndroid={true} extraScrollHeight={120}>

        <View style={ss.sec}>
          <Text style={ss.stit}>DATOS PERSONALES</Text>
          <View style={ss.privaNota}>
            <Text style={ss.privaNotaTxt}>Tu identidad es anonima para el trabajador hasta que ambos decidan contactarse.</Text>
          </View>
          <View style={{flexDirection:'row',gap:10}}>
            <View style={{flex:1}}><Field label="Primer nombre" value={nombre} onChange={setNombre} placeholder="Nombre"/></View>
            <View style={{flex:1}}><Field label="Segundo nombre" value={nombre2} onChange={setNombre2} placeholder="Segundo nombre" optional/></View>
          </View>
          <View style={{flexDirection:'row',gap:10}}>
            <View style={{flex:1}}><Field label="Primer apellido" value={apellido1} onChange={setApellido1} placeholder="Apellido"/></View>
            <View style={{flex:1}}><Field label="Segundo apellido" value={apellido2} onChange={setApellido2} placeholder="Segundo apellido" optional/></View>
          </View>
          <Field label="Telefono" value={telefono} onChange={setTelefono} placeholder="Ej: 099 123 456" keyboard="phone-pad"/>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>UBICACION</Text>
          <SearchField label="Pais" value={pais} onChange={setPais} placeholder="Tu pais..." suggestions={PAISES} onSelect={v=>{setPais(v);setCiudad('');}}/>
          <SearchField label="Ciudad" value={ciudad} onChange={setCiudad} placeholder="Tu ciudad..." suggestions={ciudadesDisp} onSelect={setCiudad}/>
          <View style={ss.fw}>
            <View style={ss.flRow}>
              <Text style={ss.fl}>Barrio</Text>
              <Text style={ss.opt}>Opcional</Text>
            </View>
            <TouchableOpacity style={[ss.fi,{justifyContent:'center'}]} onPress={()=>navigation.navigate('SelectorOficio',{onSelect:setBarrio,opciones:barriosDisp,titulo:'Seleccionar barrio',placeholder:'Buscar barrio...'})}>
              <Text style={{fontSize:14,color:barrio?'#1A1020':'#A898B8'}}>{barrio||'Toca para elegir tu barrio'}</Text>
            </TouchableOpacity>
          </View>
          <Field label="Direccion" value={direccion} onChange={setDireccion} placeholder="Ej: Av. Italia 1234" optional/>
        </View>

        <TouchableOpacity style={ss.btnW} onPress={guardar} disabled={saving}>
          <LinearGradient colors={['#E8785A','#D4614A']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            <Text style={ss.btnT}>{saving?'Guardando...':'Guardar datos'}</Text>
          </LinearGradient>
        </TouchableOpacity>

      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:'#FBF8F4'},
  hdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  back:{fontSize:14,fontWeight:'700',color:'#2DD4BF'},htit:{fontSize:16,fontWeight:'800',color:'#1A1020'},
  sec:{marginHorizontal:16,marginBottom:16,marginTop:8},
  stit:{fontSize:10,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:10},
  privaNota:{backgroundColor:'#F0FDFA',borderRadius:8,padding:10,marginBottom:12,borderLeftWidth:3,borderLeftColor:'#2DD4BF'},
  privaNotaTxt:{fontSize:12,color:'#2DD4BF',lineHeight:18},
  fw:{marginBottom:14},flRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6},
  fl:{fontSize:12,fontWeight:'700',color:'#5A4E6A',marginBottom:6},
  opt:{fontSize:10,color:'#A898B8',fontStyle:'italic'},
  fi:{backgroundColor:'#FFFFFF',borderWidth:1.5,borderColor:'#EDE8E2',borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:'#1A1020'},
  sugg:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EDE8E2',borderRadius:10,marginTop:4,overflow:'hidden'},
  suggI:{paddingHorizontal:14,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  suggT:{fontSize:14,color:'#1A1020'},
  btnW:{marginHorizontal:16,marginTop:8,borderRadius:14,overflow:'hidden'},
  btn:{paddingVertical:16,alignItems:'center'},btnT:{color:'#FFFFFF',fontSize:16,fontWeight:'800'},
});
