import base64
import os

# Read the logo
with open('ID_CARDS/KeMU Logo.jpg', 'rb') as f:
    logo_b64 = base64.b64encode(f.read()).decode('utf-8')

jsx_content = f"""import React, {{ useRef }} from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {{ Download }} from 'lucide-react';

const IDCard = ({{ student }}) => {{
  const cardRef = useRef(null);

  const issueYear = new Date().getFullYear();
  const expiryYear = issueYear + (student.programme && student.programme.includes('DIPLOMA') ? 2 : 4);

  const downloadPDF = async () => {{
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, {{ scale: 4, useCORS: true }});
    const imgData = canvas.toDataURL('image/png');
    // Standard CR80 landscape (85.6mm x 54mm)
    const pdf = new jsPDF('landscape', 'mm', [85.6, 54]);
    pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);
    pdf.save(`${{student.reg_no.replace(/\//g, '-')}}_ID_Card.pdf`);
  }};

  const kemuLogo = "data:image/jpeg;base64,{logo_b64}";

  return (
    <div style={{{{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}}}>
      
      {{/* 856x540 is exactly 10x the mm dimensions of a CR80 card (85.6 x 54.0), ensuring perfect aspect ratio */}}
      <div 
        ref={{cardRef}}
        style={{{{
          width: '856px',
          height: '540px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          position: 'relative',
          fontFamily: "Arial, Helvetica, sans-serif",
          color: '#1A2D5C',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fdfdfd'
        }}}}
      >
        {{/* Mountain Watermark SVG (Custom Mt Kenya representation) */}}
        <div style={{{{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, opacity: 0.15, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}}}>
           <svg viewBox="0 0 1000 500" width="100%" height="100%" preserveAspectRatio="none">
              <path d="M100 500 L300 250 L350 280 L450 150 L520 200 L650 50 L750 180 L800 120 L950 500 Z" fill="none" stroke="#1A2D5C" strokeWidth="3" />
              <path d="M150 500 L320 290 L400 350 L480 200 L550 250 L680 90 L720 150 L850 500 Z" fill="none" stroke="#1A2D5C" strokeWidth="1.5" />
              <path d="M200 500 L350 320 M450 150 L480 250 M650 50 L680 150 M750 180 L800 250" fill="none" stroke="#1A2D5C" strokeWidth="2" />
              {{/* Ridges and lines to make it look like a sketch */}}
              <path d="M450 150 L420 200 L430 250 L400 300" fill="none" stroke="#1A2D5C" strokeWidth="1" />
              <path d="M650 50 L620 120 L640 180 L600 250" fill="none" stroke="#1A2D5C" strokeWidth="1" />
           </svg>
        </div>

        {{/* Top Header Background Split */}}
        <div style={{{{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: '140px',
          background: 'linear-gradient(105deg, #6B235E 0%, #6B235E 80%, #1A2D5C 80.1%, #1A2D5C 100%)',
          zIndex: 2,
          borderBottom: '6px solid #D4AF37'
        }}}}>
          <div style={{{{ padding: '15px 30px', textAlign: 'center', position: 'relative' }}}}>
            <h1 style={{{{ 
              margin: '0', 
              color: '#D4AF37', 
              fontFamily: "'Times New Roman', Times, serif", 
              fontSize: '42px',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.4)'
            }}}}>
              KENYA METHODIST UNIVERSITY
            </h1>
            <p style={{{{ 
              margin: '8px 0 0 0', 
              color: '#ffffff', 
              fontSize: '16px', 
              lineHeight: '1.3',
              fontFamily: "Arial, sans-serif"
            }}}}>
              P.O. BOX 267-60200 Meru<br/>
              Tel: (+254-020) 2118423-7, 064-30301/31229 Fax: (+254-0647)<br/>
              Email: info@kemu.ac.ke website: www.kemu.ac.ke
            </p>
          </div>
        </div>

        {{/* Diagonal side shapes */}}
        <div style={{{{ position: 'absolute', right: 0, top: '146px', width: '250px', height: '350px', background: '#1A2D5C', clipPath: 'polygon(100% 0, 100% 100%, 0 0)', zIndex: 1 }}}}></div>
        <div style={{{{ position: 'absolute', right: 0, bottom: 0, width: '150px', height: '150px', background: '#6B235E', clipPath: 'polygon(100% 100%, 0 100%, 100% 0)', zIndex: 1 }}}}></div>

        {{/* 4 Gold horizontal stripes on the left */}}
        <div style={{{{ position: 'absolute', left: 0, top: '280px', display: 'flex', flexDirection: 'column', gap: '14px', zIndex: 2 }}}}>
          <div style={{{{ width: '40px', height: '5px', backgroundColor: '#D4AF37' }}}}></div>
          <div style={{{{ width: '30px', height: '5px', backgroundColor: '#D4AF37' }}}}></div>
          <div style={{{{ width: '45px', height: '5px', backgroundColor: '#D4AF37' }}}}></div>
          <div style={{{{ width: '35px', height: '5px', backgroundColor: '#D4AF37' }}}}></div>
        </div>

        {{/* Main Content Body */}}
        <div style={{{{ position: 'absolute', top: '146px', left: 0, right: 0, bottom: 0, padding: '30px 40px', display: 'flex', zIndex: 3 }}}}>
          
          {{/* Left Details */}}
          <div style={{{{ flex: 1, display: 'flex', flexDirection: 'column' }}}}>
            <h2 style={{{{ 
              margin: '10px 0 8px 0', 
              color: '#1A2D5C', 
              fontSize: '34px', 
              fontWeight: '900',
              fontFamily: "'Times New Roman', Times, serif",
              textTransform: 'uppercase'
            }}}}>
              {{student.name}}
            </h2>
            <h3 style={{{{ 
              margin: '0 0 35px 0', 
              color: '#6B235E', 
              fontSize: '18px', 
              fontWeight: '700',
              textTransform: 'uppercase',
              maxWidth: '85%'
            }}}}>
              {{student.programme || 'Student Programme'}}
            </h3>
            
            <div style={{{{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '20px', fontWeight: '700', color: '#1A2D5C' }}}}>
              <div style={{{{ display: 'flex' }}}}>
                <span style={{{{ width: '220px' }}}}>ADMISSION NO.</span>
                <span style={{{{ color: '#000', fontWeight: '600' }}}}>{{student.reg_no}}</span>
              </div>
              <div style={{{{ display: 'flex' }}}}>
                <span style={{{{ width: '220px' }}}}>DATE OF ISSUE:</span>
                <span style={{{{ color: '#000', fontWeight: '600' }}}}>{{issueYear}}</span>
              </div>
              <div style={{{{ display: 'flex' }}}}>
                <span style={{{{ width: '220px' }}}}>EXPIRY DATE:</span>
                <span style={{{{ color: '#000', fontWeight: '600' }}}}>{{expiryYear}}</span>
              </div>
            </div>
          </div>

          {{/* Right Photo */}}
          <div style={{{{ 
            width: '210px', 
            height: '210px', 
            borderRadius: '50%', 
            border: '6px solid #D4AF37', 
            outline: '2px solid #ffffff',
            outlineOffset: '-8px',
            overflow: 'hidden',
            backgroundColor: '#f0f0f0',
            position: 'absolute',
            right: '40px',
            top: '25px',
            boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
          }}}}>
            <img 
              src={{student.avatar || `https://ui-avatars.com/api/?name=${{encodeURIComponent(student.name)}}&background=1A2D5C&color=fff&size=400`}} 
              alt={{student.name}}
              style={{{{ width: '100%', height: '100%', objectFit: 'cover' }}}}
              crossOrigin="anonymous" 
            />
          </div>
          
          {{/* NFC Icon */}}
          <div style={{{{
            position: 'absolute',
            right: '50px',
            bottom: '70px',
            color: '#D4AF37',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8.242C2.121 9.94 1 12.336 1 15v3.5a1.5 1.5 0 0 0 1.5 1.5h19a1.5 1.5 0 0 0 1.5-1.5V15c0-2.664-1.121-5.06-2.999-6.758" />
              <path d="M7 11.242C5.642 12.43 4.8 14.113 4.8 16v3" />
              <path d="M10 14.242A5.19 5.19 0 0 0 8.6 17v2" />
              <path d="M13.6 17v2" />
              <path d="M17 11.242C18.358 12.43 19.2 14.113 19.2 16v3" />
            </svg>
            <span style={{{{ fontSize: '12px', fontWeight: '900', color: '#1A2D5C', marginTop: '5px' }}}}>NFC ENABLED</span>
          </div>
        </div>

        {{/* Footer Bottom Elements */}}
        <div style={{{{ 
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: '110px', 
          zIndex: 4,
          padding: '0 40px',
          display: 'flex',
          alignItems: 'flex-end'
        }}}}>
          
          {{/* Logo Extracted from Image */}}
          <div style={{{{ 
            width: '85px', 
            height: '85px', 
            borderRadius: '50%',
            overflow: 'hidden',
            marginBottom: '20px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
            border: '2px solid #fff'
          }}}}>
            <img src={{kemuLogo}} alt="KeMU Logo" style={{{{ width: '100%', height: '100%', objectFit: 'cover' }}}} />
          </div>
          
          {{/* Custom SVG Signature */}}
          <div style={{{{ marginLeft: '20px', paddingBottom: '25px', display: 'flex', flexDirection: 'column' }}}}>
            <div style={{{{ width: '140px', height: '40px', marginLeft: '10px' }}}}>
              <svg viewBox="0 0 200 80" width="100%" height="100%">
                {{/* Simulated 'J. Halary' signature */}}
                <path d="M 50 10 Q 30 10 30 30 Q 30 60 40 60 C 50 60 60 40 60 20 C 60 0 40 0 40 20 C 40 40 50 60 70 70 M 80 50 C 90 20 100 20 110 50 C 120 70 110 70 120 50 M 130 50 C 140 30 150 40 140 60 M 160 50 C 170 30 180 50 160 70 C 150 80 180 60 190 40 M 80 45 L 120 45 M 70 65 L 180 65" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{{{ borderTop: '2px solid #1A2D5C', width: '220px', paddingTop: '4px' }}}}>
              <span style={{{{ fontSize: '13px', fontWeight: '700', color: '#000' }}}}>Academic Registrar's Signature</span>
            </div>
          </div>

          {{/* Student ID Banner Container */}}
          <div style={{{{
            position: 'absolute',
            bottom: '40px',
            right: '40px',
            width: '520px',
            height: '40px',
            background: 'linear-gradient(90deg, #ffffff 0%, #f0f0f0 100%)',
            borderTop: '3px solid #1A2D5C',
            borderBottom: '3px solid #1A2D5C',
            transform: 'skewX(-20deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '-4px 4px 8px rgba(0,0,0,0.15)'
          }}}}>
            <div style={{{{ transform: 'skewX(20deg)', display: 'flex', gap: '10px', alignItems: 'center' }}}}>
              <span style={{{{ color: '#1A2D5C', fontWeight: '900', fontSize: '24px', letterSpacing: '1px' }}}}>STUDENT</span>
              <span style={{{{ color: '#D4AF37', fontWeight: '900', fontSize: '24px', letterSpacing: '1px', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}}}>IDENTIFICATION</span>
              <span style={{{{ color: '#1A2D5C', fontWeight: '900', fontSize: '24px', letterSpacing: '1px' }}}}>CARD</span>
            </div>
          </div>
          
          {{/* Fine Print */}}
          <div style={{{{
            position: 'absolute',
            bottom: '8px',
            left: '40px',
            right: '40px',
            fontSize: '11px',
            fontWeight: '600',
            lineHeight: '1.2',
            color: '#111',
            paddingRight: '150px' 
          }}}}>
            This card is a property of Kenya Methodist University and must be returned on demand or upon expiry.<br/>
            It incorporates advanced micro-textured elements for authentication.
          </div>
        </div>
      </div>

      <button 
        onClick={{downloadPDF}}
        className="btn btn-primary"
        style={{{{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.75rem 1.5rem', fontSize: '1.1rem' }}}}
      >
        <Download size={20} />
        Download High-Res ID Card
      </button>
    </div>
  );
}};

export default IDCard;
"""

with open('frontend/src/components/IDCard.jsx', 'w') as f:
    f.write(jsx_content)
print("Successfully generated IDCard.jsx with base64 logo and precise design.")
