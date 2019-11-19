## Contents
* **json** contains four indices that are used by the tool in order to load the data, together with the data in the **frames** folder.
* **frames** contains:
   * *frame_to_info.json* - description for all FrameNet frames, which includes their roles.
   * *dominant_frame_info.json*:
        * Q_ID ->
            * **likely** likely frames given the event type
            * **other** all other frames, i.e., non-likely frames
* **naf** has three subfolders **en**, **it**, and **nl**. The English subfolder
contains the pre-annotation in two forms:
    * pre-annotation with a proposed frame
      ```
      xml
      <predicate id="pr14">
      <span>
        <target id="t34"/>
      </span>
      <externalReferences>
        <externalRef reference="Performers_and_roles" resource="FrameNet" source="pre-annotator" reftype="evoke"/>
      </externalReferences>
    </predicate>
        ```
    * pre-annotation without a proposed frame
        ```xml
      <predicate id="pr15">
      <span>
        <target id="t38"/>
      </span>
      </predicate>
       ```
