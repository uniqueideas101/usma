export type MockStudent = {
  id: string
  name: string
  community: 'ST' | 'PVTG'
  state: string
  educationLevel: string
  income: number
  institutionType: string
  institutionCategory: 'Government' | 'Premier' | 'Foreign'
  documents: {
    casteCertificateUploaded: boolean
    incomeCertificateUploaded: boolean
    aadhaarLinked: boolean
  }
}

export const scholarshipSchemes: {
  id: string
  name: string
  educationLevel: string
  incomeCeiling: number
}[]

export const mockStudents: MockStudent[]

export const mockApplications: {
  id: string
  studentId: string
  schemeId: string
  currentStage: 'Draft' | 'Submitted' | 'Institute Verified' | 'State Approved' | 'Sanctioned' | 'Disbursed'
  lastUpdatedTimestamp: string
  disbursementDetails?: {
    transactionId: string
    amount: number
    date: string
    scheduled: boolean
  }
}[]
