// src/pages/legal/LegalNotice.jsx
import React from "react";

export default function LegalNotice() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 text-sm md:text-base">
      <h1 className="text-2xl font-bold mb-4">Aviso Legal</h1>

      <p className="mb-4">
        <strong>ConectCity</strong> es una plataforma digital que brinda un
        espacio para publicar y visualizar oportunidades de empleo, alquileres,
        ventas, emprendimientos y servicios de delivery.
      </p>
      <p className="mb-4">
        ConectCity no actúa como parte en las relaciones contractuales que se
        generen entre usuarios ni garantiza la veracidad de la totalidad de las
        publicaciones, aunque se reserva el derecho de moderar y eliminar
        contenido que pueda resultar fraudulento o contrario a la ley.
      </p>
      <p className="mb-4">
        El uso de la plataforma se realiza bajo exclusiva responsabilidad del
        usuario. Recomendamos siempre verificar la identidad de la otra parte y
        extremar precauciones antes de concretar pagos, entrevistas o
        encuentros.
      </p>
    </main>
  );
}
