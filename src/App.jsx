export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#07080d',
      color: '#eaedf4',
      fontFamily: 'Arial, sans-serif',
      padding: '40px'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '42px',
          marginBottom: '10px',
          color: '#f5a623'
        }}>
          FieldPulse
        </h1>

        <p style={{
          fontSize: '18px',
          color: '#c9d1d9',
          marginBottom: '40px'
        }}>
          Educational Simulation Environment for Oil & Gas Field Economics,
          Production Decline Behaviour, and Operational Decision Learning.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>

          <div style={{
            background: '#11131a',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #1f2430'
          }}>
            <h2 style={{ color: '#f5a623' }}>Production Decline</h2>
            <p>
              Visualizes production decline behaviour and field-level economic
              sensitivity under changing operating conditions.
            </p>
          </div>

          <div style={{
            background: '#11131a',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #1f2430'
          }}>
            <h2 style={{ color: '#f5a623' }}>Economic Limit Logic</h2>
            <p>
              Demonstrates how lifting cost, operating expenditure, and oil
              price influence economic continuation decisions.
            </p>
          </div>

          <div style={{
            background: '#11131a',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #1f2430'
          }}>
            <h2 style={{ color: '#f5a623' }}>Simulation-Based Learning</h2>
            <p>
              Designed as an educational simulation environment for applied
              operational reasoning and professional learning.
            </p>
          </div>
        </div>

        <div style={{
          background: '#11131a',
          padding: '30px',
          borderRadius: '18px',
          border: '1px solid #1f2430',
          marginBottom: '30px'
        }}>
          <h2 style={{ color: '#f5a623', marginBottom: '20px' }}>
            FieldPulse Educational Simulation Overview
          </h2>

          <ul style={{ lineHeight: '1.9', color: '#d0d7de' }}>
            <li>Production decline behaviour interpretation</li>
            <li>Operating expenditure sensitivity</li>
            <li>Economic Limit analysis</li>
            <li>Workover economics understanding</li>
            <li>Instructional simulation architecture</li>
            <li>Operational decision-learning support</li>
          </ul>
        </div>

        <div style={{
          background: '#0f1720',
          borderLeft: '4px solid #f5a623',
          padding: '20px',
          borderRadius: '12px',
          color: '#c9d1d9'
        }}>
          <strong style={{ color: '#f5a623' }}>Disclaimer:</strong>
          <p style={{ marginTop: '10px', lineHeight: '1.8' }}>
            FieldPulse is an educational simulation environment developed for
            instructional and learning purposes. It is not commercial petroleum
            software and is not intended for operational field reporting or
            certified engineering use.
          </p>

          <p style={{ marginTop: '16px', lineHeight: '1.8' }}>
            The Field Diagnostic Score referenced in the learning environment is
            an educational composite indicator created for simulation and
            learning purposes.
          </p>

          <p style={{ marginTop: '20px', color: '#8b949e' }}>
            © 2026 Rahul Sharma. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
