import React,{useState,useEffect}from 'react';
import{View,Text,StyleSheet,TouchableOpacity,TextInput,ScrollView,Alert,ActivityIndicator}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{supabase}from '../../services/supabase';
import*as Localization from 'expo-localization';

const MONEDA_POR_REGION={UY:'UYU',AR:'ARS',BR:'BRL',ES:'EUR',PT:'EUR',FR:'EUR',DE:'EUR',IT:'EUR',GB:'GBP'};
function monedaDefecto(){
  const region=Localization.getLocales?.()?.[0]?.regionCode||Localization.region||'';
  return MONEDA_POR_REGION[region]||'USD';
}

const C={coral:'#E8785A',teal:'#2DD4BF',blanco:'#FFFFFF',crema:'#FBF8F4',borde:'#EDE8E2',texto1:'#1A1020',texto2:'#5A4E6A',texto3:'#A898B8'};

const MODALIDADES=['presencial','remoto','hibrido'];
const CONTRATOS=['full_time','part_time','contrato','freelance'];
const MONEDAS=['USD','UYU','ARS','BRL','EUR'];

function Field({label,value,onChange,placeholder,multi,keyboard,optional}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
      <TextInput
        style={[ss.fi,multi&&{height:90,textAlignVertical:'top'}]}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor="#A898B8"
        multiline={multi} keyboardType={keyboard||'default'}
      />
    </View>
  );
}

function Chips({label,opts,sel,onSelect,optional,labelMap}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
      <View style={ss.chipWrap}>
        {opts.map(o=>{
          const active=sel===o;
          return(
            <TouchableOpacity key={o} style={[ss.chip,active&&ss.chipOn]} onPress={()=>onSelect(active?null:o)}>
              <Text style={[ss.chipTxt,active&&ss.chipTxtOn]}>{labelMap?labelMap[o]:o}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const MODALIDAD_LBL={presencial:'🏢 Presencial',remoto:'💻 Remoto',hibrido:'🔄 Híbrido'};
const CONTRATO_LBL={full_time:'Tiempo completo',part_time:'Medio tiempo',contrato:'Contrato',freelance:'Freelance'};

export default function CrearOfertaScreen({navigation,route}){
  const editando=route.params?.oferta||null;
  const[loading,setLoading]=useState(false);

  const[titulo,setTitulo]=useState(editando?.titulo||'');
  const[cargo,setCargo]=useState(editando?.cargo||'');
  const[descripcion,setDescripcion]=useState(editando?.descripcion||'');
  const[requisitos,setRequisitos]=useState(editando?.requisitos||'');
  const[ciudad,setCiudad]=useState(editando?.ciudad||'');
  const[modalidad,setModalidad]=useState(editando?.modalidad||null);
  const[tipoContrato,setTipoContrato]=useState(editando?.tipo_contrato||null);
  const[salarioMin,setSalarioMin]=useState(editando?.salario_min?.toString()||'');
  const[salarioMax,setSalarioMax]=useState(editando?.salario_max?.toString()||'');
  const[moneda,setMoneda]=useState(editando?.moneda||monedaDefecto());
  const[fechaCierre,setFechaCierre]=useState(editando?.fecha_cierre||'');

  async function guardar(){
    if(!titulo.trim()){Alert.alert('Requerido','El título de la oferta es obligatorio.');return;}
    setLoading(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert('Error','Debés iniciar sesión');return;}

      const payload={
        employer_id:user.id,
        titulo:titulo.trim(),
        cargo:cargo.trim()||null,
        descripcion:descripcion.trim()||null,
        requisitos:requisitos.trim()||null,
        ciudad:ciudad.trim()||null,
        modalidad:modalidad||null,
        tipo_contrato:tipoContrato||null,
        salario_min:salarioMin?parseFloat(salarioMin):null,
        salario_max:salarioMax?parseFloat(salarioMax):null,
        moneda,
        fecha_cierre:fechaCierre||null,
        updated_at:new Date().toISOString(),
      };

      let error;
      if(editando){
        ({error}=await supabase.from('ofertas').update(payload).eq('id',editando.id));
      }else{
        ({error}=await supabase.from('ofertas').insert(payload));
      }
      if(error)throw error;

      Alert.alert(editando?'Oferta actualizada':'Oferta publicada',editando?'Los cambios fueron guardados.':'Tu oferta ya es visible para los trabajadores.',[{text:'OK',onPress:()=>navigation.goBack()}]);
    }catch(e){Alert.alert('Error','No se pudo guardar la oferta. Intentá de nuevo.');}
    finally{setLoading(false);}
  }

  async function eliminar(){
    Alert.alert('Eliminar oferta','¿Estás seguro? Esta acción no se puede deshacer.',[
      {text:'Cancelar',style:'cancel'},
      {text:'Eliminar',style:'destructive',onPress:async()=>{
        setLoading(true);
        const{error}=await supabase.from('ofertas').delete().eq('id',editando.id);
        setLoading(false);
        if(error){Alert.alert('Error','No se pudo eliminar.');return;}
        navigation.goBack();
      }},
    ]);
  }

  return(
    <SafeAreaView style={ss.c} edges={['top']}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Text style={ss.back}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={ss.htit}>{editando?'Editar oferta':'Nueva oferta'}</Text>
        <TouchableOpacity onPress={guardar} disabled={loading}>
          {loading?<ActivityIndicator size="small" color={C.coral}/>:<Text style={ss.saveBtn}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={ss.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Field label="Título de la oferta *" value={titulo} onChange={setTitulo} placeholder="Ej: Plomero para reparaciones urgentes"/>
        <Field label="Cargo / Puesto" value={cargo} onChange={setCargo} placeholder="Ej: Plomero" optional/>
        <Field label="Descripción" value={descripcion} onChange={setDescripcion} placeholder="Describí el trabajo, horarios, condiciones..." multi optional/>
        <Field label="Requisitos" value={requisitos} onChange={setRequisitos} placeholder="Experiencia mínima, habilidades, herramientas..." multi optional/>
        <Field label="Ciudad" value={ciudad} onChange={setCiudad} placeholder="Ej: Montevideo" optional/>

        <Chips label="Modalidad" opts={MODALIDADES} sel={modalidad} onSelect={setModalidad} labelMap={MODALIDAD_LBL} optional/>
        <Chips label="Tipo de contrato" opts={CONTRATOS} sel={tipoContrato} onSelect={setTipoContrato} labelMap={CONTRATO_LBL} optional/>

        <View style={ss.fw}>
          <Text style={ss.fl}>Salario (opcional)</Text>
          <View style={ss.salaryRow}>
            <TextInput style={[ss.fi,{flex:1}]} value={salarioMin} onChangeText={setSalarioMin} placeholder="Mínimo" placeholderTextColor="#A898B8" keyboardType="numeric"/>
            <Text style={ss.salaryDash}>—</Text>
            <TextInput style={[ss.fi,{flex:1}]} value={salarioMax} onChangeText={setSalarioMax} placeholder="Máximo" placeholderTextColor="#A898B8" keyboardType="numeric"/>
          </View>
          <View style={ss.chipWrap}>
            {MONEDAS.map(m=>(
              <TouchableOpacity key={m} style={[ss.chip,moneda===m&&ss.chipOn]} onPress={()=>setMoneda(m)}>
                <Text style={[ss.chipTxt,moneda===m&&ss.chipTxtOn]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={ss.fw}>
          <View style={ss.flRow}>
            <Text style={ss.fl}>Fecha de cierre</Text>
            <Text style={ss.opt}>Opcional — formato YYYY-MM-DD</Text>
          </View>
          <TextInput style={ss.fi} value={fechaCierre} onChangeText={setFechaCierre} placeholder="2026-06-30" placeholderTextColor="#A898B8"/>
        </View>

        {editando&&(
          <TouchableOpacity style={ss.deleteBtn} onPress={eliminar}>
            <Text style={ss.deleteTxt}>🗑 Eliminar oferta</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:'#FBF8F4'},
  hdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:C.blanco,borderBottomWidth:1,borderBottomColor:C.borde},
  back:{fontSize:14,fontWeight:'700',color:C.texto3},
  htit:{fontSize:16,fontWeight:'800',color:C.texto1},
  saveBtn:{fontSize:14,fontWeight:'800',color:C.coral},
  content:{padding:16,paddingBottom:48},
  fw:{marginBottom:18},
  flRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6},
  fl:{fontSize:13,fontWeight:'700',color:C.texto2},
  opt:{fontSize:10,color:C.texto3,fontWeight:'600'},
  fi:{backgroundColor:C.blanco,borderRadius:12,borderWidth:1,borderColor:C.borde,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:C.texto1},
  chipWrap:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:8},
  chip:{borderRadius:20,borderWidth:1.5,borderColor:C.borde,paddingHorizontal:14,paddingVertical:7,backgroundColor:C.blanco},
  chipOn:{backgroundColor:C.coral,borderColor:C.coral},
  chipTxt:{fontSize:13,color:C.texto2,fontWeight:'600'},
  chipTxtOn:{color:C.blanco},
  salaryRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4},
  salaryDash:{fontSize:16,color:C.texto3,fontWeight:'700'},
  deleteBtn:{marginTop:16,backgroundColor:'#FFF0F0',borderRadius:14,paddingVertical:14,alignItems:'center',borderWidth:1.5,borderColor:'#FFCDD2'},
  deleteTxt:{fontSize:15,fontWeight:'700',color:'#E53E3E'},
});
