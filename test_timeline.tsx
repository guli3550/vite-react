                          <div className="modernTimeline">
                            <div className="modernTimelineInner">
                              <div className="mt-line-bg"></div>
                              <div className="mt-line-fill" style={{ width: 
                                o.status === "Yetkazildi" ? "100%" : 
                                o.status === "Qabul qilishga tayyor" ? "75%" : 
                                o.status === "Yo‘lda" ? "50%" : 
                                o.status === "Tayyorlanmoqda" ? "25%" : 
                                (o.status === "Qabul qilindi" || o.status === "To'lov tasdiqlandi") ? "10%" : "0%"
                              }}></div>

                              {/* 1. Qabul qilindi */}
                              <div className={`mt-step ${['Qabul qilindi', "To'lov tasdiqlandi", 'Tayyorlanmoqda', 'Yo‘lda', 'Qabul qilishga tayyor', 'Yetkazildi'].includes(o.status) ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <span className="mt-label">Qabul qilindi</span>
                              </div>

                              {/* 2. Tayyorlanmoqda */}
                              <div className={`mt-step ${o.status === 'Tayyorlanmoqda' ? 'pulse' : ['Yo‘lda', 'Qabul qilishga tayyor', 'Yetkazildi'].includes(o.status) ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                                </div>
                                <span className="mt-label">Jarayonda</span>
                              </div>

                              {/* 3. Yo'lda */}
                              <div className={`mt-step ${o.status === 'Yo‘lda' ? 'pulse' : ['Qabul qilishga tayyor', 'Yetkazildi'].includes(o.status) ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                </div>
                                <span className="mt-label">Yo'lda</span>
                              </div>

                              {/* 4. Punktda */}
                              <div className={`mt-step ${o.status === 'Qabul qilishga tayyor' ? 'pulse' : o.status === 'Yetkazildi' ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                                </div>
                                <span className="mt-label">Punktda</span>
                              </div>

                              {/* 5. Yakunlandi */}
                              <div className={`mt-step ${o.status === 'Yetkazildi' ? 'active' : ''}`}>
                                <div className="mt-circle">
                                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <span className="mt-label">Yakunlandi</span>
                              </div>
                            </div>
                          </div>
