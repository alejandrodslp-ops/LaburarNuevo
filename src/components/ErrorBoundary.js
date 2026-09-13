import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary atrapó un error:', error, info?.componentStack);
  }

  reintentar = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={ss.container}>
          <Text style={ss.emoji}>😕</Text>
          <Text style={ss.titulo}>Algo salió mal</Text>
          <Text style={ss.sub}>No es tu culpa — pasó un error inesperado. Probá de nuevo.</Text>
          <TouchableOpacity style={ss.btn} onPress={this.reintentar}>
            <Text style={ss.btnTxt}>Reintentar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const ss = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8F5F2', alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji:      { fontSize: 48, marginBottom: 16 },
  titulo:     { fontSize: 20, fontWeight: '900', color: '#1A3A5C', marginBottom: 8, textAlign: 'center' },
  sub:        { fontSize: 14, color: '#A898B8', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  btn:        { backgroundColor: '#E8785A', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  btnTxt:     { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
