'use client'

import { useState, useEffect, Fragment } from 'react'

export interface StepItem {
  label: string
}

export interface StepperProps {
  steps: StepItem[]
  currentStep: number       // 1-indexed
  processTitle?: string     // shown left of divider on desktop
  paddingX?: number         // desktop left/right padding, default 165
  actionSlot?: React.ReactNode  // optional right-side content on desktop
}

type StepState = 'complete' | 'current' | 'future'

const CHECKMARK_PATH =
  'M12.3716 18C12.229 18 12.0904 17.9533 11.9768 17.8672L8.25817 15.0459C8.12018 14.9411 8.02948 14.7857 8.00602 14.614C7.98256 14.4424 8.02826 14.2684 8.13308 14.1304C8.23789 13.9924 8.39323 13.9017 8.56492 13.8782C8.73661 13.8548 8.91059 13.9005 9.04858 14.0053L12.2133 16.4068L16.9572 9.29072C17.0048 9.21935 17.0661 9.15806 17.1374 9.11034C17.2087 9.06263 17.2887 9.02943 17.3728 9.01263C17.457 8.99584 17.5436 8.99579 17.6278 9.01247C17.7119 9.02916 17.792 9.06226 17.8634 9.10988C17.9347 9.15751 17.996 9.21872 18.0437 9.29003C18.0914 9.36135 18.1246 9.44136 18.1414 9.5255C18.1582 9.60964 18.1583 9.69627 18.1416 9.78043C18.1249 9.8646 18.0918 9.94465 18.0442 10.016L12.915 17.7091C12.8553 17.7987 12.7744 17.8721 12.6794 17.9229C12.5844 17.9736 12.4784 18.0001 12.3707 18H12.3716Z'

function CompleteCircle() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="13" cy="13" r="12.25" stroke="var(--rmg-color-green-contrast)" strokeWidth="1.5"/>
      <path d={CHECKMARK_PATH} fill="var(--rmg-color-green-contrast)"/>
    </svg>
  )
}

function CurrentCircle({ stepNumber }: { stepNumber: number }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="13" cy="13" r="13" fill="var(--rmg-color-black)"/>
      <text
        x="13"
        y="13"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--rmg-color-white)"
        fontSize="14"
        fontWeight="400"
        style={{ fontFamily: 'var(--rmg-font-body)' }}
      >
        {stepNumber}
      </text>
    </svg>
  )
}

function FutureCircle({ stepNumber }: { stepNumber: number }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="13" cy="13" r="12.5" fill="var(--rmg-color-white)" stroke="var(--rmg-color-text-light)" strokeWidth="1"/>
      <text
        x="13"
        y="13"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--rmg-color-text-light)"
        fontSize="14"
        fontWeight="400"
        style={{ fontFamily: 'var(--rmg-font-body)' }}
      >
        {stepNumber}
      </text>
    </svg>
  )
}

export function Stepper({
  steps,
  currentStep,
  processTitle,
  paddingX = 165,
  actionSlot,
}: StepperProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const totalSteps = steps.length

  const getStepState = (index: number): StepState => {
    const stepNumber = index + 1
    if (stepNumber < currentStep) return 'complete'
    if (stepNumber === currentStep) return 'current'
    return 'future'
  }

  const containerStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'var(--rmg-color-white)',
    borderTop: '1px solid var(--rmg-color-grey-2)',
    display: 'flex',
    alignItems: 'center',
  }

  // ── Mobile layout ────────────────────────────────────────────────
  if (isMobile) {
    const circumference = 2 * Math.PI * 24
    const dashOffset = circumference * (1 - currentStep / totalSteps)
    const currentStepItem = steps[currentStep - 1]
    const nextStepItem = currentStep < totalSteps ? steps[currentStep] : null

    return (
      <div
        style={{
          ...containerStyle,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          justifyContent: 'flex-start',
          gap: 16,
        }}
      >
        {/* Circular progress ring */}
        <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Track */}
            <circle
              cx="30" cy="30" r="24"
              fill="none"
              stroke="var(--rmg-color-grey-2)"
              strokeWidth="6"
            />
            {/* Progress arc */}
            <circle
              cx="30" cy="30" r="24"
              fill="none"
              stroke="var(--rmg-color-green-contrast)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${dashOffset}`}
              transform="rotate(-90 30 30)"
            />
          </svg>
          {/* "N of M" overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              fontWeight: 700,
              lineHeight: '16px',
              color: 'var(--rmg-color-text-heading)',
            }}
          >
            {currentStep} of {totalSteps}
          </div>
        </div>

        {/* Text column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              fontWeight: 700,
              color: 'var(--rmg-color-text-heading)',
            }}
          >
            {currentStepItem?.label}
          </span>
          {nextStepItem && (
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c1)',
                lineHeight: 'var(--rmg-leading-c1)',
                fontWeight: 400,
                color: 'var(--rmg-color-text-light)',
              }}
            >
              Next: {nextStepItem.label}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── Desktop layout ───────────────────────────────────────────────
  const getLabelColor = (state: StepState): string => {
    if (state === 'complete') return 'var(--rmg-color-green-contrast)'
    if (state === 'current') return 'var(--rmg-color-text-heading)'
    return 'var(--rmg-color-text-light)'
  }

  const getConnectorColor = (state: StepState): string =>
    state === 'complete' ? 'var(--rmg-color-green-contrast)' : 'var(--rmg-color-grey-2)'

  return (
    <div
      style={{
        ...containerStyle,
        paddingTop: 14,
        paddingBottom: 14,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        justifyContent: 'space-between',
      }}
    >
      {/* Left: process title + divider + step list */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {processTitle && (
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 16,
              lineHeight: '24px',
              fontWeight: 700,
              color: 'var(--rmg-color-text-heading)',
              whiteSpace: 'nowrap',
            }}
          >
            {processTitle}
          </span>
        )}
        {processTitle && (
          <div
            style={{
              width: 1,
              height: 32,
              backgroundColor: 'var(--rmg-color-grey-2)',
              flexShrink: 0,
            }}
          />
        )}

        {/* Step list */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {steps.map((step, index) => {
            const state = getStepState(index)
            const stepNumber = index + 1
            const isLast = index === steps.length - 1

            return (
              <Fragment key={index}>
                {/* Step: circle + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {state === 'complete' && <CompleteCircle />}
                  {state === 'current' && <CurrentCircle stepNumber={stepNumber} />}
                  {state === 'future' && <FutureCircle stepNumber={stepNumber} />}
                  <span
                    style={{
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-c1)',
                      lineHeight: 'var(--rmg-leading-c1)',
                      fontWeight: 400,
                      color: getLabelColor(state),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
                {/* Connector line — not after last step */}
                {!isLast && (
                  <div
                    style={{
                      width: 20,
                      height: 0,
                      borderTop: `1px solid ${getConnectorColor(state)}`,
                      flexShrink: 0,
                    }}
                  />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* Right: action slot */}
      {actionSlot && (
        <div style={{ flexShrink: 0 }}>
          {actionSlot}
        </div>
      )}
    </div>
  )
}
