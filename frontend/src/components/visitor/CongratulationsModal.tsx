"use client"

import React from "react"

export interface CongratulationsModalProps {
  open: boolean
  onClose: () => void
}

export default function CongratulationsModal({ open, onClose }: CongratulationsModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white py-8 px-10 rounded-xl shadow-xl w-[400px] text-center">
        <h2 className="text-[#008235] text-2xl font-bold mb-2">
          Congratulations!
        </h2>

        <p className="text-[#697282] text-base mb-6">
          Visitor record not found in the Blacklisted Visitors.
        </p>

        <button
          onClick={onClose}
          className="bg-[#155DFC] text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Okay
        </button>
      </div>
    </div>
  )
}
