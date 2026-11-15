import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: "About the data" };

export default function AboutPage() {
  return (
    <main className="prose">
      <h1>About the data</h1>

      <section>
        <h2>What you are looking at</h2>
        <p>
          {APP_NAME} compares active-fire detections from two families of NASA satellite sensors: MODIS (on Terra and Aqua, 1 km pixels) and
          VIIRS (on S-NPP, NOAA-20 and NOAA-21, 375 m pixels). Where a MODIS and a VIIRS detection fall close together in space and time, they
          are linked as potentially corresponding and combined into one harmonized record.
        </p>
        <ul>
          <li>A hotspot is a satellite detection of heat, not a confirmed fire. One fire can produce many detections, and some detections are not fires.</li>
          <li>A detection seen by only one sensor is not an error. The sensors differ in resolution and in the time they pass overhead.</li>
          <li>Agreement between the sensors is internal consistency, not accuracy against ground truth.</li>
          <li>Live pairs use the project&apos;s spatial limit and a selectable 30–180 minute time window. A pair means possible correspondence, not proof that two detections came from the same fire.</li>
          <li>Live data covers the latest 24 hours in the available NASA files. Missing source files or their update cadence can make a snapshot incomplete or delayed.</li>
        </ul>
      </section>

      <section>
        <h2>What is real and what is sample</h2>
        <p>
          In Sample history mode on the map or globe, and on the calendar screen, the markers, counts, and charts use generated placeholder
          data shaped like FIRMS records. They are not real detections.
        </p>
        <p>
          In <strong>Live · last 24 h</strong> mode on the map or globe, markers and counts come from NASA FIRMS&apos; public global CSV files.
          The same-origin endpoint downloads those files on the server and caches the result for 30 minutes. Each source&apos;s row
          count, last-modified time, and availability are shown so partial snapshots are visible. The GIBS thermal-anomaly overlay
          in Sample history is a separate NASA product for a selected date.
        </p>
        <p>
          In <strong>Backend · month</strong> mode, the map and globe read the project backend for the selected month and area. If the
          backend has imported harmonization predictions, the selected-record panel can show a calibrated probability and FRP; until
          then those fields remain marked as not produced.
        </p>
      </section>

      <section>
        <h2>Sources</h2>
        <ul>
          <li>
            Active-fire detections: NASA{" "}
            <a href="https://earthdata.nasa.gov/firms" target="_blank" rel="noreferrer">Fire Information for Resource Management System (FIRMS)</a>.
          </li>
          <li>
            Imagery and daily thermal-anomaly layers: NASA{" "}
            <a href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api" target="_blank" rel="noreferrer">Global Imagery Browse Services (GIBS)</a>.
          </li>
          <li>Country outlines: Natural Earth, public domain.</li>
        </ul>
      </section>

      <section>
        <h2>Acknowledgment</h2>
        <blockquote>
          We acknowledge the use of data and/or imagery from NASA&apos;s Fire Information for Resource Management System (FIRMS)
          (https://earthdata.nasa.gov/firms), part of NASA&apos;s Land, Atmosphere Near real-time Capability for Earth observations (LANCE)
          (https://earthdata.nasa.gov/lance) and NASA&apos;s Earth Science Data and Information System (ESDIS).
        </blockquote>
      </section>

      <section>
        <h2>Disclaimer</h2>
        <p>
          FIRMS is operated by the ESDIS project. The information presented through LANCE, GIBS, Worldview and FIRMS is provided &ldquo;as
          is&rdquo; and users bear all responsibility and liability for their use of data. See the{" "}
          <a href="https://www.earthdata.nasa.gov/data/tools/firms/disclaimer" target="_blank" rel="noreferrer">full FIRMS disclaimer</a>.
        </p>
        <p>
          This tool was built for the NASA Space Apps Challenge. It is not endorsed by NASA, and it does not replace official fire products or
          emergency-response systems.
        </p>
      </section>
    </main>
  );
}
