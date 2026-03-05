"use client"

import type React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUp, UserPlus } from "lucide-react"
import RouteGuard from "@/components/route-guard"
import SurveyHarianReponse from "./reponse-harian"
import SurveyMingguanResponse from "./response-mingguan"
import WordCloud from "@/components/word-cloud"
import { useEffect, useState } from "react"

function InputDataContent() {
  const [isLoading, setIsLoading] = useState(true);

  // Dummy loading 0.5s
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading){
    return(
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Memuat data...</p>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mulai Survey</h1>
          <p className="mt-2 text-gray-600">Pilih tipe survey yang akan dibuka</p>
        </div>

        <Tabs defaultValue="harian" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="harian" className="flex items-center">
              <UserPlus className="h-4 w-4 mr-2" />
              Survey Harian
            </TabsTrigger>
            <TabsTrigger value="mingguan" className="flex items-center">
              <FileUp className="h-4 w-4 mr-2" />
              Survey Mingguan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="harian">
            <SurveyHarianReponse />
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-800">WordCloud Respon Harian</h2>
                <p className="text-sm text-slate-600">
                  Visualisasi kata yang paling sering muncul dari jawaban terbuka siswa pada survey harian.
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <WordCloud type="harian" />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="mingguan">
            <SurveyMingguanResponse />
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-800">WordCloud Respon Mingguan</h2>
                <p className="text-sm text-slate-600">
                  Visualisasi kata yang paling sering muncul dari jawaban terbuka siswa pada survey mingguan.
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <WordCloud type="mingguan" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    
  )
}

export default function InputSurveyPage() {
  return (
    <RouteGuard requireAuth={true} allowedRoles={["guru", "admin"]}>
      <InputDataContent />
    </RouteGuard>
  )
}
